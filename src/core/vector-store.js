import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";

/**
 * SemanticChunker - splits text based on semantic similarity
 */
export class SemanticChunker {
  constructor(embeddings, options = {}) {
    this.embeddings = embeddings;
    this.bufferSize = options.bufferSize || 1;
    this.breakpointThresholdType = options.breakpointThresholdType || "percentile";
    this.breakpointThresholdAmount = options.breakpointThresholdAmount;
    this.sentenceSplitRegex = options.sentenceSplitRegex || /(?<=[.?!])\s+/;
  }

  // Calculate cosine distance between two vectors
  cosineDistance(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
    return 1 - dotProduct / (magnitudeA * magnitudeB);
  }

  // Calculate breakpoint threshold based on distances
  calculateBreakpointThreshold(distances) {
    if (this.breakpointThresholdAmount !== undefined) {
      return this.breakpointThresholdAmount;
    }

    if (this.breakpointThresholdType === "percentile") {
      const sorted = [...distances].sort((a, b) => a - b);
      const index = Math.floor(sorted.length * 0.95);
      return sorted[index];
    } else if (this.breakpointThresholdType === "standard_deviation") {
      const mean = distances.reduce((sum, val) => sum + val, 0) / distances.length;
      const variance = distances.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / distances.length;
      const stdDev = Math.sqrt(variance);
      return mean + stdDev;
    } else if (this.breakpointThresholdType === "interquartile") {
      const sorted = [...distances].sort((a, b) => a - b);
      const q1Index = Math.floor(sorted.length * 0.25);
      const q3Index = Math.floor(sorted.length * 0.75);
      const q1 = sorted[q1Index];
      const q3 = sorted[q3Index];
      const iqr = q3 - q1;
      return q3 + 1.5 * iqr;
    }

    const sorted = [...distances].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index];
  }

  async splitText(text) {
    const sentences = text.split(this.sentenceSplitRegex).filter(s => s.trim().length > 0);

    if (sentences.length <= 1) {
      return [text];
    }

    const groups = [];
    for (let i = 0; i < sentences.length; i += this.bufferSize) {
      const group = sentences.slice(i, i + this.bufferSize).join(" ");
      groups.push(group);
    }

    if (groups.length <= 1) {
      return [text];
    }

    const embeddings = await this.embeddings.embedDocuments(groups);

    const distances = [];
    for (let i = 0; i < embeddings.length - 1; i++) {
      const distance = this.cosineDistance(embeddings[i], embeddings[i + 1]);
      distances.push(distance);
    }

    if (distances.length === 0) {
      return [text];
    }

    const threshold = this.calculateBreakpointThreshold(distances);

    const breakpoints = [0];
    for (let i = 0; i < distances.length; i++) {
      if (distances[i] > threshold) {
        breakpoints.push(i + 1);
      }
    }
    breakpoints.push(groups.length);

    const chunks = [];
    for (let i = 0; i < breakpoints.length - 1; i++) {
      const start = breakpoints[i];
      const end = breakpoints[i + 1];
      const chunk = groups.slice(start, end).join(" ");
      if (chunk.trim().length > 0) {
        chunks.push(chunk);
      }
    }

    return chunks.length > 0 ? chunks : [text];
  }

  async splitDocuments(documents) {
    const splitDocs = [];

    for (const doc of documents) {
      const chunks = await this.splitText(doc.pageContent);

      for (const chunk of chunks) {
        splitDocs.push(
          new Document({
            pageContent: chunk,
            metadata: { ...doc.metadata }
          })
        );
      }
    }

    return splitDocs;
  }
}

/**
 * Create vector store from documents
 * @param {Array} docs - Documents to embed
 * @returns {Promise<MemoryVectorStore>} Vector store instance
 */
export async function createVectorStore(docs) {
  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004",
  });

  const textSplitter = new SemanticChunker(embeddings, {
    breakpointThresholdType: "interquartile",
  });

  const splits = await textSplitter.splitDocuments(docs);
  return await MemoryVectorStore.fromDocuments(splits, embeddings);
}