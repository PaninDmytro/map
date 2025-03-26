import { NgModule } from '@angular/core';
import { RouterOutlet } from "@angular/router";

import { MapComponent } from "./map.component";
import { MapRoutingModule } from "./map-routing.modules";
import { MapService } from "./services/map.service";


@NgModule({
  declarations: [MapComponent],
  imports: [
    RouterOutlet,
    MapRoutingModule
  ],
  providers: [MapService]
})
export class MapModule { }
