import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

/**
 * GeminiImageProvider
 *
 * Encapsulates all Gemini / Imagen 4 API logic.
 * Single responsibility: receive a prompt string, return a base64 JPEG data URL.
 * Never exposed outside ImageModule.
 */
@Injectable()
export class GeminiImageProvider {
  private readonly client: GoogleGenAI;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'GEMINI_API_KEY is not set. Add it to your .env file.',
      );
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  /**
   * Calls Imagen 4 and returns a base64 data URL ready to embed in <img src>.
   * Throws InternalServerErrorException if generation fails.
   */
  async generateImage(prompt: string): Promise<string> {
    try {
      const response = await this.client.models.generateImages({
        model:  'imagen-4.0-generate-001',
        prompt,
        config: {
          numberOfImages: 1,
          aspectRatio:    '1:1',
          outputMimeType: 'image/jpeg',
        },
      });

      const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
      if (!imageBytes) {
        throw new Error('Imagen 4 returned no image bytes.');
      }

      return `data:image/jpeg;base64,${imageBytes}`;
    } catch (err: any) {
      throw new InternalServerErrorException(
        `Gemini image generation failed: ${err?.message ?? 'unknown error'}`,
      );
    }
  }
}
