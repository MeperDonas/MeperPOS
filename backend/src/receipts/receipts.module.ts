import { Module } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';

@Module({
  providers: [ReceiptsService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
