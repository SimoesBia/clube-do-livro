import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { Perfil } from '../../core/modelos';
import { ClubeService } from '../../core/clube.service';
import { AvatarMembroComponent } from '../../shared/avatar/avatar-membro.component';
import { LivroDoMesComponent } from '../../shared/livro-do-mes/livro-do-mes.component';
import { RoletaComponent } from '../../shared/roleta/roleta.component';
import { TopoComponent } from '../../shared/topo/topo.component';

@Component({
  selector: 'app-inicio',
  imports: [IonContent, IonSpinner, IonButton, TopoComponent, AvatarMembroComponent, LivroDoMesComponent, RoletaComponent],
  templateUrl: './inicio.page.html',
  styleUrl: './inicio.page.scss',
})
export class InicioPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly clube = inject(ClubeService);

  protected readonly membros = signal<Perfil[]>([]);
  protected readonly carregando = signal(true);

  private readonly agora = new Date();
  private readonly mesAtual = this.agora.getMonth() + 1;
  private readonly diaAtual = this.agora.getDate();
  protected readonly nomeDoMes = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(this.agora);

  protected readonly primeiroNome = computed(() => (this.auth.perfil()?.nome ?? '').trim().split(' ')[0]);

  // Quem faz aniversário neste mês, em ordem de dia
  protected readonly aniversariantes = computed(() =>
    this.membros()
      .filter((m) => this.partes(m.aniversario)?.mes === this.mesAtual)
      .sort((a, b) => (this.partes(a.aniversario)?.dia ?? 0) - (this.partes(b.aniversario)?.dia ?? 0)),
  );

  // Quem faz aniversário hoje
  protected readonly deHoje = computed(() => this.aniversariantes().filter((m) => this.ehHoje(m)));

  // Roda toda vez que a pessoa chega nesta aba
  async ionViewWillEnter() {
    void this.clube.carregar();
    this.membros.set(await this.auth.listarMembros());
    this.carregando.set(false);
  }

  protected irParaPerfil() {
    this.router.navigateByUrl('/perfil');
  }

  protected ehHoje(m: Perfil): boolean {
    return this.partes(m.aniversario)?.dia === this.diaAtual;
  }

  protected rotulo(m: Perfil): string {
    if (this.ehHoje(m)) return 'É hoje! 🎂';
    return `dia ${this.partes(m.aniversario)?.dia}`;
  }

  // Lê "2001-10-25" e devolve { mes: 10, dia: 25 } (sem mexer com fuso horário)
  private partes(data: string | null): { mes: number; dia: number } | null {
    if (!data) return null;
    const [, mes, dia] = data.split('-').map(Number);
    return { mes, dia };
  }
}
