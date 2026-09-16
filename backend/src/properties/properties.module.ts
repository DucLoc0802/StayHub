import { Module } from '@nestjs/common';
import { HostPropertiesController, PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';

@Module({ controllers: [PropertiesController, HostPropertiesController], providers: [PropertiesService] })
export class PropertiesModule {}
