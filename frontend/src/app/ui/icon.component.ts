import { Component, Input } from '@angular/core';

// Inline SVG icon set. Names map to a path-data closure so the bundle stays tiny.
const ICONS: Record<string, string> = {
  folder: 'M3 6.5A2.5 2.5 0 0 1 5.5 4h3.4a2 2 0 0 1 1.4.6l1 1a2 2 0 0 0 1.4.6H18.5A2.5 2.5 0 0 1 21 8.7v8.8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11Z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7',
  edit: 'M4 20h4l10.5-10.5a2.83 2.83 0 0 0-4-4L4 16v4Z',
  play: 'M6 4.5v15l13-7.5z',
  pause: 'M7 5h3v14H7zM14 5h3v14h-3z',
  layers: 'M12 3l9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 18l9 5 9-5',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  check: 'M5 12l5 5L20 7',
  chevron: 'M9 18l6-6-6-6',
  archive: 'M3 7h18l-1.5 13a2 2 0 0 1-2 1.7H6.5a2 2 0 0 1-2-1.7L3 7Zm0 0V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2M10 11h4',
  spark: 'M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M5 19l4-4M15 9l4-4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3c0-.4 0-.8-.1-1.2l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5a7.5 7.5 0 0 0 0 2.4l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2Z',
  close: 'M6 6l12 12M18 6L6 18',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" [attr.stroke-width]="weight" stroke-linecap="round"
         stroke-linejoin="round" aria-hidden="true">
      <path [attr.d]="path"></path>
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; line-height: 0; pointer-events: none; }
    svg { pointer-events: none; }
  `]
})
export class IconComponent {
  @Input() name = 'folder';
  @Input() size: number | string = 18;
  @Input() weight: number | string = 1.6;
  get path() { return ICONS[this.name] ?? ICONS['folder']; }
}
