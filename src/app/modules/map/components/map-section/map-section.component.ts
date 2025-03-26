import { Component, ElementRef, ViewChild, Renderer2, AfterViewInit, inject, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-arrowheads';
import { Subject, takeUntil } from "rxjs";

import { MapService } from "../../services/map.service";
import { IPoint } from "../../interfaces/point.interface";

@Component({
  selector: 'app-map-section',
  templateUrl: './map-section.component.html',
  standalone: true,
  styleUrls: ['./map-section.component.scss']
})
export class MapSectionComponent implements AfterViewInit, OnDestroy {
  private renderer: Renderer2 = inject(Renderer2);
  private mapService: MapService = inject(MapService);
  private map!: L.Map;
  private drawnItems: L.FeatureGroup = new L.FeatureGroup();
  private points: IPoint[] = [];
  private routeLine!: L.Polyline;
  private nextId = 1;
  private destroy$: Subject<void> = new Subject<void>();

  @ViewChild('mapContainer', { static: true }) mapContainer: ElementRef;

  ngAfterViewInit(): void {
    this.initMap();
    this.initDrawingControls();
  }

  ngOnDestroy(): void {
    this.points.forEach(point => {
      if (point.marker) {
        point.marker.off();
        this.map.removeLayer(point.marker);
      }
    });

    this.map.off();

    if (this.map) {
      this.map.remove();
    }

    this.destroy$.next();
    this.destroy$.complete();

  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement).setView([50.4501, 30.5234], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.routeLine = L.polyline([], { color: 'blue', weight: 3 }).addTo(this.map);
    this.drawnItems.addTo(this.map);
  }

  private initDrawingControls(): void {
    const drawControl = new (L.Control as any).Draw({
      edit: {
        featureGroup: this.drawnItems,
        remove: true
      },
      draw: {
        marker: {
          icon: this.createDefaultMarkerIcon()
        },
        polygon: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        polyline: false
      }
    });

    this.map.addControl(drawControl);

    this.map.on(L.Draw.Event.CREATED, (e: any) => {
      if (e.layerType === 'marker') {
        const marker = e.layer as L.Marker;
        this.setupMarkerIcon(marker);
        marker.dragging?.enable();
        this.addPoint(marker);
      }
    });

    this.map.on('draw:edited', (e: any) => {
      const layers = e.layers;
      layers.eachLayer((layer: L.Marker) => {
        this.updatePointPosition(layer);
      });
      this.updateRoute();
    });

    this.map.on('draw:deleted', (e: any) => {
      const layers = e.layers;
      layers.eachLayer((layer: L.Marker) => {
        this.removePoint(layer);
      });
    });
  }

  private createDefaultMarkerIcon(): L.Icon {
    return L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34]
    });
  }

  private setupMarkerIcon(marker: L.Marker): void {
    marker.setIcon(this.createDefaultMarkerIcon());
  }

  private addPoint(marker: L.Marker): void {
    const latLng = marker.getLatLng();
    const point: IPoint = {
      id: this.nextId++,
      number: this.points.length + 1,
      lat: latLng.lat,
      lng: latLng.lng,
      alt: 0,
      marker: marker
    };

    this.points.push(point);
    this.drawnItems.addLayer(marker);
    this.updateRoute();
    this.bindPopup(marker, point);

    marker.dragging?.enable();
    marker.on('dragend', () => {
      this.updatePointPosition(marker);
      this.updatePopupContent(marker);
    });
  }

  private bindPopup(marker: L.Marker, point: IPoint): void {
    const popupContent = this.createPopupContent(point);
    marker.bindPopup(popupContent, {
      closeButton: false,
      className: 'marker-popup'
    });

    marker.on('popupopen', () => {
      this.setupPopupEvents(marker, point);
    });
  }

  private updatePopupContent(marker: L.Marker): void {
    const point = this.points.find(p => p.marker === marker);
    if (!point) return;

    const popup = marker.getPopup();
    if (popup) {
      const newContent = this.createPopupContent(point);
      popup.setContent(newContent);
    }
  }

  private createPopupContent(point: IPoint): HTMLElement {
    const popup = this.renderer.createElement('div');
    this.renderer.addClass(popup, 'point-popup');

    const content = `
      <h3>Point #${point.number}</h3>
      <div class="form-group">
        <label>Latitude:</label>
        <input type="number" step="0.000001" value="${point.lat}" class="lat-input">
      </div>
      <div class="form-group">
        <label>Longitude:</label>
        <input type="number" step="0.000001" value="${point.lng}" class="lng-input">
      </div>
      <div class="form-group">
        <label>Altitude (m):</label>
        <input type="number" value="${point.alt}" class="alt-input">
      </div>
      <div class="popup-actions">
        <button class="save-btn">Save</button>
        <button class="delete-btn">Delete</button>
      </div>
    `;

    popup.innerHTML = content;
    return popup;
  }

  private setupPopupEvents(marker: L.Marker, point: IPoint): void {
    const popup = marker.getPopup()?.getElement();
    if (!popup) return;

    const saveBtn = popup.querySelector('.save-btn');
    const deleteBtn = popup.querySelector('.delete-btn');
    const latInput = popup.querySelector('.lat-input') as HTMLInputElement;
    const lngInput = popup.querySelector('.lng-input') as HTMLInputElement;
    const altInput = popup.querySelector('.alt-input') as HTMLInputElement;

    if (saveBtn) {
      this.renderer.listen(saveBtn, 'click', () => {
        point.lat = parseFloat(latInput.value);
        point.lng = parseFloat(lngInput.value);
        point.alt = parseFloat(altInput.value);

        marker.setLatLng([point.lat, point.lng]);
        this.updateRoute();
        marker.closePopup();
        this.sendPointsToServer();
      });
    }

    if (deleteBtn) {
      this.renderer.listen(deleteBtn, 'click', () => {
        this.removePoint(marker);
        this.sendPointsToServer();
      });
    }
  }

  private updatePointPosition(marker: L.Marker): void {
    const point = this.points.find(p => p.marker === marker);
    if (!point) return;

    const latLng = marker.getLatLng();
    point.lat = latLng.lat;
    point.lng = latLng.lng;
    this.updateRoute();
    this.sendPointsToServer();
  }

  private removePoint(marker: L.Marker): void {
    this.points = this.points.filter(p => p.marker !== marker);

    this.drawnItems.removeLayer(marker);
    if (this.map.hasLayer(marker)) {
      this.map.removeLayer(marker);
    }

    this.renumberPoints();

    this.updateRoute();
  }

  private renumberPoints(): void {
    this.points.sort((a, b) => a.number - b.number);

    this.points.forEach((point, index) => {
      point.number = index + 1;
    });

    this.points.forEach(point => {
      this.updatePopupContent(point.marker);
    });
  }

  private updateRoute(): void {
    const sortedPoints = [...this.points].sort((a, b) => a.number - b.number);
    const latLngs = sortedPoints.map(point => [point.lat, point.lng] as L.LatLngExpression);

    this.routeLine.setLatLngs(latLngs);

    if (latLngs.length > 1) {
      (this.routeLine as any).arrowheads({
        size: '15px',
        frequency: 'endonly',
        fill: true,
        color: 'blue'
      });
    }
  }

  private sendPointsToServer(): void {
    const sortedPoints = [...this.points].sort((a, b) => a.number - b.number);

    this.mapService.sendPoints(sortedPoints)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: () => console.log('Points sent successfully'),
      error: (err) => console.error('Error sending points:', err)
    });
  }
}
