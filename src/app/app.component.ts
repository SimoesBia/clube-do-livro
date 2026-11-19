import { ResumoMembroComponent } from './shared/resumo-membro/resumo-membro.component';
import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, ResumoMembroComponent],
})
export class AppComponent {
  constructor() {}
}
