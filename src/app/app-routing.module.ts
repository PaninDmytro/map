import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'map',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'map',
    loadChildren: () =>
      import('./modules/map/map.module').then(m => m.MapModule),
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
