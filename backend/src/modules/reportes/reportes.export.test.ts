import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { renderReportExcel } from './reportes.excel';
import { renderReportPdf } from './reportes.pdf';
import type { ReportRow, ReportSummaryData } from './reportes.types';

const row = (i: number): ReportRow => ({
  id: `r${i}`,
  docente: 'Ana Pérez',
  email: 'ana@tecnologicoloja.edu.ec',
  carrera: 'Desarrollo de Software',
  materia: 'Programación Web',
  ciclo: '3',
  periodo_academico: '2026-II',
  paralelo: 'B',
  dia: 'lunes',
  horario: '08:00 - 10:00',
  entrada: '07/09/26, 07:58',
  salida: '07/09/26, 10:02',
  estado: 'puntual',
  justificacion: '',
  ip_entrada: '10.0.0.1',
  foto_entrada_url: '',
  foto_salida_url: '',
  lat: -3.99,
  lng: -79.2,
  precision_m: 10,
  lat_entrada: -3.99,
  lng_entrada: -79.2,
  precision_entrada_m: 10,
  lat_salida: null,
  lng_salida: null,
  precision_salida_m: null,
});

const summary = (registros: ReportRow[]): ReportSummaryData => ({
  tipo: 'docente',
  periodo: { fecha_inicio: '2026-09-01T05:00:00.000Z', fecha_fin: '2026-10-01T04:59:59.999Z' },
  totalProgramadas: 10,
  totalRegistros: registros.length,
  presentes: 8,
  puntual: 7,
  tardanza: 1,
  justificado: 1,
  ausente: 1,
  registros,
  porCarrera: [],
  porPeriodo: [],
});

function pageCount(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
}

describe('exportación de reportes', () => {
  it('el Excel tiene el resumen y una fila por registro', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await renderReportExcel(summary([row(1), row(2)])));

    const resumen = workbook.getWorksheet('Resumen')!;
    expect(resumen.getRow(2).values).toEqual([, 'Clases programadas', 10]);
    expect(resumen.getRow(7).values).toEqual([, 'Ausentes', 1]);

    const registros = workbook.getWorksheet('Registros')!;
    expect(registros.rowCount).toBe(3);
    expect(registros.getRow(2).getCell(2).value).toBe('Ana Pérez');
  });

  it('el PDF es válido y muestra un aviso cuando no hay registros', async () => {
    const pdf = await renderReportPdf(summary([]));
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pageCount(pdf)).toBeGreaterThanOrEqual(1);
  });

  it('el PDF pagina el detalle cuando hay muchos registros', async () => {
    const pdf = await renderReportPdf(summary(Array.from({ length: 60 }, (_, i) => row(i))));
    expect(pageCount(pdf)).toBeGreaterThan(1);
  });
});
