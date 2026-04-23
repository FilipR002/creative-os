import { Injectable } from '@nestjs/common';
import { GeminiImageProvider } from './providers/gemini-image.provider';
import { buildImagePrompt, SlideContent, ImageMetadata } from './utils/prompt-builder';

// ─── Public contracts ─────────────────────────────────────────────────────────

export interface GenerateImageInput {
  slide:    SlideContent;
  metadata: ImageMetadata;
}

export interface ImageResult {
  imageUrl:   string;           // base64 data URL — ready for <img src>
  promptUsed: string;
  provider:   'gemini';
  metadata:   ImageMetadata;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * ImageService
 *
 * Orchestrates: prompt-builder → GeminiImageProvider → ImageResult.
 * The only public surface exported from ImageModule.
 */
@Injectable()
export class ImageService {
  constructor(private readonly gemini: GeminiImageProvider) {}

  /** Generate a single image from a pre-built prompt string. */
  async generateFromPrompt(prompt: string, metadata: ImageMetadata): Promise<ImageResult> {
    const imageUrl = await this.gemini.generateImage(prompt);
    return { imageUrl, promptUsed: prompt, provider: 'gemini', metadata };
  }

  /** Generate a single image for one slide. */
  async generate(input: GenerateImageInput): Promise<ImageResult> {
    const prompt   = buildImagePrompt(input.slide, input.metadata);
    const imageUrl = await this.gemini.generateImage(prompt);

    return {
      imageUrl,
      promptUsed: prompt,
      provider:   'gemini',
      metadata:   input.metadata,
    };
  }

  /**
   * Generate images for all slides in parallel.
   * Returns results in the same order as the input array.
   * Individual slide failures are captured and returned as null imageUrl
   * so one bad slide never kills the entire batch.
   */
  async generateBatch(
    inputs: GenerateImageInput[],
  ): Promise<(ImageResult & { slideNumber: number; error: string | null })[]> {
    return Promise.all(
      inputs.map(async (input, i) => {
        try {
          const result = await this.generate(input);
          return { ...result, slideNumber: i + 1, error: null };
        } catch (err: any) {
          return {
            imageUrl:   '',
            promptUsed: buildImagePrompt(input.slide, input.metadata),
            provider:   'gemini' as const,
            metadata:   input.metadata,
            slideNumber: i + 1,
            error:      err?.message ?? 'Generation failed',
          };
        }
      }),
    );
  }
}
