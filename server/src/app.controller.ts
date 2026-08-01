import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { AppService } from './app.service';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('posts')
  getPosts() {
    return this.appService.getPosts();
  }

  @Get('posts/:id')
  getPost(@Param('id', ParseIntPipe) id: number) {
    return this.appService.getPost(id);
  }

  @Post('posts')
  createPost(@Body() body: { title: string; content: string }) {
    return this.appService.createPost(body);
  }
}
