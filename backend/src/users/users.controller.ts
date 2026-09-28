import { BadRequestException, Body, Controller, Get, Post } from "@nestjs/common";
import { UsersService } from "./users.service.js";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  create(@Body() body: { email?: string }) {
    if (!body.email) {
      throw new BadRequestException("El email es obligatorio");
    }
    return this.usersService.create(body.email);
  }
}