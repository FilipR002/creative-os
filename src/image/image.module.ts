import { Module } from '@nestjs/common';
import { ImageService } from './image.service';
import { GeminiImageProvider } from './providers/gemini-image.provider';

/**
 * ImageModule
 *
 * Exports only ImageService.
 * GeminiImageProvider is an internal implementation detail — never re-exported.
 *
 * Import this module wherever image generation is needed.
 */
@Module({
  providers: [ImageService, GeminiImageProvider],
  exports:   [ImageService],
})
export class ImageModule {}
