import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PythonController } from './python.controller.js';
import { PythonService } from './python.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PythonController],
  providers: [PythonService],
  exports: [PythonService],
})
export class PythonModule {}
