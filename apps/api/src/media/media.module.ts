import { Global, Module } from '@nestjs/common';
import { FfmpegService } from './ffmpeg.service';
import { ScanService } from './scan.service';

@Global()
@Module({ providers: [FfmpegService, ScanService], exports: [FfmpegService, ScanService] })
export class MediaModule {}
