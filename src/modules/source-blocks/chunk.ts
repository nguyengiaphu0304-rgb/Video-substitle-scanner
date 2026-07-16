export function chunkLectureText(text: string, maxChars: number = 1000): string[] {
  const paragraphs = text.split(/\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 1 <= maxChars) {
      currentChunk += (currentChunk.length ? "\n" : "") + paragraph;
    } else {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}
