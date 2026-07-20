import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SequenceService } from './sequence.service';

@Module({
  imports: [PrismaModule],
  providers: [SequenceService],
  exports: [SequenceService],
})
export class SequenceModule {}
