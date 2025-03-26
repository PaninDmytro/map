import { inject, Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

import { IPoint } from "../interfaces/point.interface";

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private http: HttpClient = inject(HttpClient);

  public sendPoints(points: IPoint[]): Observable<IPoint[]> {
    return this.http.post<IPoint[]>('https://test-api/points', points);
  }
}
