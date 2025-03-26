import * as L from 'leaflet';

export interface IPoint {
  number: number;
  id: number;
  lat: number;
  lng: number;
  alt: number;
  marker:  L.Marker;
}
