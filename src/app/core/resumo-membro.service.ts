import { Injectable, signal } from '@angular/core';

// Guarda qual membro está com o "cartãozinho de resumo" aberto (nenhum = fechado)
@Injectable({ providedIn: 'root' })
export class ResumoMembroService {
  readonly aberto = signal<string | null>(null);

  abrir(perfilId: string) {
    this.aberto.set(perfilId);
  }

  fechar() {
    this.aberto.set(null);
  }
}
