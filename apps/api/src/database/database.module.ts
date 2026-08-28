import {
  Module,
  type OnApplicationShutdown,
  type OnModuleInit,
} from "@nestjs/common";
import { DatabaseService } from "./database.service.js";

@Module({
  providers: [
    {
      provide: DatabaseService,
      useFactory: () => new DatabaseService(process.env.DATABASE_URL ?? ""),
    },
  ],
  exports: [DatabaseService],
})
export class DatabaseModule implements OnModuleInit, OnApplicationShutdown {
  constructor(private readonly database: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    await this.database.assertReady();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.database.close();
  }
}
