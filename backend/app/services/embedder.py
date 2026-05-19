from typing import List, Optional
from openai import AsyncOpenAI
from app.config import settings

_client: Optional[AsyncOpenAI] = None


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


async def embed_texts(texts: List[str], batch_size: int = 100) -> List[List[float]]:
    """Embed a list of texts using OpenAI text-embedding-3-small in batches."""
    client = get_openai_client()
    all_embeddings = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        # Clean texts
        batch = [t.replace("\n", " ").strip()[:8000] for t in batch]

        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=batch,
        )
        embeddings = [item.embedding for item in response.data]
        all_embeddings.extend(embeddings)

    return all_embeddings


async def embed_query(query: str) -> List[float]:
    """Embed a single query string."""
    results = await embed_texts([query])
    return results[0]
