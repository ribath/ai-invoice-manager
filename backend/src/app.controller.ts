import { Controller, GET } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @GET('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
