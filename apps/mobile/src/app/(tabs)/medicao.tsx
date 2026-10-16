import { Redirect } from 'expo-router';

// Rota de apoio da aba "Medição": o toque na aba é interceptado no layout e
// abre o cadastro da nova instalação. Se acessada por link, faz o mesmo.
export default function MeasurementTab() {
  return <Redirect href="/instalacao/novo-cliente" />;
}
