/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { OpenAIEmbedding } from '@zilliz/claude-context-core'
import { parseEnv } from './env'

export type Vectors = {
  dense: number[]
  sparse: {
    indices: number[]
    values: number[]
  }
}

async function createDenseEmbedding(text: string): Promise<Vectors['dense']> {
  const env = parseEnv()
  const embedding = new OpenAIEmbedding({
    apiKey: env.OPENAI_API_KEY,
    model: 'text-embedding-3-small',
  })
  return (await embedding.embed(text)).vector
}

async function createSparseEmbedding(text: string): Promise<Vectors['sparse']> {
  const response = await fetch(
    'https://gwizinc--splade-splade-vector.modal.run',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: [text],
        model: 'naver/splade-cocondenser-ensembledistil',
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `SPLADE service error: ${response.status} ${response.statusText} - ${errorText}`,
    )
  }

  const data = (await response.json()) as { vectors: Vectors['sparse'][] }
  return data.vectors[0]
}

export async function createEmbeddings(text: string): Promise<Vectors> {
  const [dense, sparse] = await Promise.all([
    createDenseEmbedding(text),
    createSparseEmbedding(text),
  ])
  return { dense, sparse }
}
