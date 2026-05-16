import { ZeroEntropy } from "zeroentropy";

const IS_MOCK = process.env.ZERO_ENTROPY_MOCK === "true";

type Metadata = Record<string, string | string[]>;

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
