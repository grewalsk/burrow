import { ZeroEntropy } from "zeroentropy";

const IS_MOCK = process.env.ZERO_ENTROPY_MOCK === "true";

export type Metadata = Record<string, string | string[]>;

type MockDoc = {
  path: string;
  collection: string;
  content: string;
  metadata: Metadata;
  indexed: boolean;
  failed?: boolean;
};

const mockStore: MockDoc[] = [];

let cachedClient: ZeroEntropy | null = null;

export function getClient(): ZeroEntropy | null {
  if (IS_MOCK) return null;
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ZEROENTROPY_API_KEY ?? "";
  if (!apiKey) {
    throw new Error(
      "ZEROENTROPY_API_KEY is not set. Set it in .env.local, or set ZERO_ENTROPY_MOCK=true to use the in-memory mock.",
    );
  }
  cachedClient = new ZeroEntropy({ apiKey });
  return cachedClient;
}

export function isMockMode(): boolean {
  return IS_MOCK;
}

export async function ensureCollection(collectionName: string): Promise<void> {
  if (IS_MOCK) return;
  const ze = getClient()!;
  try {
    await ze.collections.add({ collection_name: collectionName });
  } catch (err: unknown) {
    if (err instanceof Error && /409|already exists|Conflict/i.test(err.message)) {
      return;
    }
    throw err;
  }
}

export async function addTextDocument(params: {
  collectionName: string;
  documentPath: string;
  text: string;
  metadata: Metadata;
}): Promise<void> {
  if (IS_MOCK) {
    const existingIdx = mockStore.findIndex(
      (d) => d.path === params.documentPath && d.collection === params.collectionName,
    );
    const doc: MockDoc = {
      path: params.documentPath,
      collection: params.collectionName,
      content: params.text,
      metadata: params.metadata,
      indexed: false,
    };
    if (existingIdx >= 0) mockStore[existingIdx] = doc;
    else mockStore.push(doc);
    setTimeout(() => {
      const d = mockStore.find(
        (x) => x.path === params.documentPath && x.collection === params.collectionName,
      );
      if (d) d.indexed = true;
    }, 80);
    return;
  }
  const ze = getClient()!;
  try {
    await ze.documents.add({
      collection_name: params.collectionName,
      path: params.documentPath,
      content: { type: "text", text: params.text },
      metadata: params.metadata,
    });
  } catch (err: unknown) {
    if (err instanceof Error && /409|already exists|Conflict/i.test(err.message)) {
      return;
    }
    throw err;
  }
}

export type ZEDocSummary = {
  path: string;
  metadata: Metadata;
  index_status: IndexStatus;
};

function normalizeFilter(filter?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!filter) return undefined;
  // ZE filter spec:
  //   - each leaf must be { attr: { $op: value } }
  //   - multi-key conjunctions must be wrapped in { $and: [...] }
  //   - $-prefixed keys (operators like $and, $or) pass through with recursive normalization of array elements
  const entries = Object.entries(filter);
  if (entries.length === 0) return undefined;

  const leaves: Record<string, unknown>[] = [];
  for (const [k, v] of entries) {
    if (k.startsWith("$")) {
      if (Array.isArray(v)) {
        leaves.push({ [k]: v.map((sub) => normalizeFilter(sub as Record<string, unknown>)) });
      } else {
        leaves.push({ [k]: v });
      }
      continue;
    }
    const key = k.startsWith("metadata.") ? k.slice("metadata.".length) : k;
    const leaf =
      v !== null && typeof v === "object" && !Array.isArray(v)
        ? { [key]: v }
        : { [key]: { $eq: v } };
    leaves.push(leaf);
  }
  if (leaves.length === 1) return leaves[0];
  return { $and: leaves };
}

export async function listDocuments(params: {
  collectionName: string;
  filter?: Record<string, unknown>;
  limit?: number;
}): Promise<ZEDocSummary[]> {
  if (IS_MOCK) {
    const filter = params.filter ?? {};
    return mockStore
      .filter((d) => d.collection === params.collectionName)
      .filter((d) =>
        Object.entries(filter).every(([k, v]) => {
          const key = k.startsWith("metadata.") ? k.slice("metadata.".length) : k;
          return d.metadata[key] === v;
        }),
      )
      .slice(0, params.limit ?? 100)
      .map((d) => ({
        path: d.path,
        metadata: d.metadata,
        index_status: d.indexed ? "indexed" : ("indexing" as IndexStatus),
      }));
  }
  const ze = getClient()!;
  // ZE's getInfoList doesn't accept filter — but topDocuments with query=null does.
  // Use topDocuments for filtered reads; it returns metadata when include_metadata=true.
  const normalized = normalizeFilter(params.filter);
  if (normalized) {
    const res = await ze.queries.topDocuments({
      collection_name: params.collectionName,
      query: null,
      k: Math.min(params.limit ?? 100, 2048),
      filter: normalized,
      include_metadata: true,
    });
    return ((res.results ?? []) as Array<{ path: string; metadata?: Metadata }>).map((d) => ({
      path: d.path,
      metadata: d.metadata ?? {},
      index_status: "indexed",
    }));
  }
  // Unfiltered list — use getInfoList for pagination.
  const out: ZEDocSummary[] = [];
  for await (const doc of ze.documents.getInfoList({
    collection_name: params.collectionName,
    limit: params.limit ?? 64,
  })) {
    out.push({
      path: doc.path,
      metadata: doc.metadata ?? {},
      index_status: doc.index_status,
    });
    if (out.length >= (params.limit ?? 100)) break;
  }
  return out;
}

export async function topDocuments(params: {
  collectionName: string;
  query: string | null;
  k: number;
  filter?: Record<string, unknown>;
}): Promise<Array<{ path: string; metadata: Metadata; score: number }>> {
  if (IS_MOCK) {
    const filter = params.filter ?? {};
    return mockStore
      .filter((d) => d.collection === params.collectionName)
      .filter((d) =>
        Object.entries(filter).every(([k, v]) => {
          const key = k.startsWith("metadata.") ? k.slice("metadata.".length) : k;
          return d.metadata[key] === v;
        }),
      )
      .slice(0, params.k)
      .map((d, i) => ({
        path: d.path,
        metadata: d.metadata,
        score: 0.9 - i * 0.05,
      }));
  }
  const ze = getClient()!;
  const res = await ze.queries.topDocuments({
    collection_name: params.collectionName,
    query: params.query,
    k: Math.max(1, Math.min(params.k, 2048)),
    filter: normalizeFilter(params.filter),
    include_metadata: true,
  });
  return ((res.results ?? []) as Array<{ path: string; metadata?: Metadata; score?: number }>).map((d) => ({
    path: d.path,
    metadata: d.metadata ?? {},
    score: d.score ?? 0,
  }));
}

export async function addDocument(params: {
  collectionName: string;
  documentPath: string;
  base64Data: string;
  metadata: Metadata;
}): Promise<void> {
  if (IS_MOCK) {
    const existingIdx = mockStore.findIndex(
      (d) => d.path === params.documentPath && d.collection === params.collectionName,
    );
    const doc: MockDoc = {
      path: params.documentPath,
      collection: params.collectionName,
      content: params.base64Data,
      metadata: params.metadata,
      indexed: false,
    };
    if (existingIdx >= 0) mockStore[existingIdx] = doc;
    else mockStore.push(doc);
    setTimeout(() => {
      const d = mockStore.find(
        (x) => x.path === params.documentPath && x.collection === params.collectionName,
      );
      if (d) d.indexed = true;
    }, 150);
    return;
  }
  const ze = getClient()!;
  try {
    await ze.documents.add({
      collection_name: params.collectionName,
      path: params.documentPath,
      content: { type: "auto", base64_data: params.base64Data },
      metadata: params.metadata,
    });
  } catch (err: unknown) {
    if (err instanceof Error && /409|already exists|Conflict/i.test(err.message)) {
      return;
    }
    throw err;
  }
}

export type IndexStatus =
  | "not_parsed"
  | "parsing"
  | "not_indexed"
  | "indexing"
  | "indexed"
  | "parsing_failed"
  | "indexing_failed"
  | "pending";

export async function updateMetadata(params: {
  collectionName: string;
  documentPath: string;
  metadata: Metadata;
}): Promise<void> {
  if (IS_MOCK) {
    const d = mockStore.find(
      (x) => x.path === params.documentPath && x.collection === params.collectionName,
    );
    if (d) d.metadata = { ...params.metadata };
    return;
  }
  const ze = getClient()!;
  await ze.documents.update({
    collection_name: params.collectionName,
    path: params.documentPath,
    metadata: params.metadata,
  });
}

export async function getDocumentContent(
  collectionName: string,
  documentPath: string,
): Promise<string | null> {
  if (IS_MOCK) {
    const d = mockStore.find(
      (x) => x.path === documentPath && x.collection === collectionName,
    );
    return d?.content ?? null;
  }
  const ze = getClient()!;
  const res = await ze.documents.getInfo({
    collection_name: collectionName,
    path: documentPath,
    include_content: true,
  });
  return (res.document as unknown as { content?: string | null }).content ?? null;
}

export async function getDocumentInfo(
  collectionName: string,
  documentPath: string,
): Promise<{ index_status: IndexStatus }> {
  if (IS_MOCK) {
    const doc = mockStore.find((d) => d.path === documentPath && d.collection === collectionName);
    if (!doc) return { index_status: "not_parsed" };
    if (doc.failed) return { index_status: "indexing_failed" };
    return { index_status: doc.indexed ? "indexed" : "indexing" };
  }
  const ze = getClient()!;
  const res = await ze.documents.getInfo({
    collection_name: collectionName,
    path: documentPath,
  });
  return { index_status: res.document.index_status };
}

export async function deleteByMetadata(
  collectionName: string,
  filter: Record<string, string>,
): Promise<{ deleted: number }> {
  if (IS_MOCK) {
    const before = mockStore.length;
    const keep = mockStore.filter(
      (d) =>
        d.collection !== collectionName ||
        !Object.entries(filter).every(([k, v]) => d.metadata[k] === v),
    );
    mockStore.splice(0, mockStore.length, ...keep);
    return { deleted: before - mockStore.length };
  }
  const ze = getClient()!;
  const results = await ze.queries.topDocuments({
    collection_name: collectionName,
    query: null,
    k: 1000,
    filter,
  });
  const docs = (results.results ?? []) as Array<{ path: string; metadata?: Metadata }>;
  if (docs.length === 0) return { deleted: 0 };
  await ze.documents.delete({
    collection_name: collectionName,
    path: docs.map((d) => d.path),
  });
  return { deleted: docs.length };
}

export function mockSearch(collectionName: string) {
  if (!IS_MOCK) throw new Error("mockSearch only available in mock mode");
  return mockStore
    .filter((d) => d.collection === collectionName && d.indexed)
    .slice(0, 3)
    .map((d, i) => ({
      document_path: d.path,
      metadata: d.metadata,
      score: 0.9 - i * 0.1,
    }));
}

export function _mockReset(): void {
  if (!IS_MOCK) return;
  mockStore.splice(0, mockStore.length);
}
