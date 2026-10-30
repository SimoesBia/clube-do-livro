import { Injectable } from '@angular/core';

// Brilhinhos que saem do dedo quando a pessoa toca em qualquer botão do app
@Injectable({ providedIn: 'root' })
export class EfeitosService {
  private ativo = false;

  iniciar() {
    if (this.ativo || typeof document === 'undefined') return;
    this.ativo = true;
    document.addEventListener('pointerdown', (evento) => this.brilhar(evento), { passive: true });
  }

  private brilhar(evento: PointerEvent) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const alvo = (evento.target as HTMLElement | null)?.closest(
      'button, ion-button, a, ion-tab-button, ion-segment-button, [role="button"], [role="radio"], [role="option"]',
    );
    if (!alvo || alvo.hasAttribute('disabled')) return;

    const simbolos = ['✨', '💖', '✨', '⭐', '✨', '💫'];
    simbolos.forEach((simbolo, i) => {
      const faisca = document.createElement('span');
      const angulo = (Math.PI * 2 * i) / simbolos.length + Math.random() * 0.6;
      const distancia = 22 + Math.random() * 22;
      faisca.className = 'faisca-clique';
      faisca.textContent = simbolo;
      faisca.style.left = `${evento.clientX}px`;
      faisca.style.top = `${evento.clientY}px`;
      faisca.style.setProperty('--dx', `${Math.cos(angulo) * distancia}px`);
      faisca.style.setProperty('--dy', `${Math.sin(angulo) * distancia - 8}px`);
      document.body.appendChild(faisca);
      setTimeout(() => faisca.remove(), 750);
    });
  }
}
