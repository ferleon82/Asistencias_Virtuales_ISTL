import ExcelJS from 'exceljs';
import type { ReportSummaryData } from './reportes.types';

export async function renderReportExcel(data: ReportSummaryData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ISTL';
  workbook.created = new Date();

  const resumenSheet = workbook.addWorksheet('Resumen');
  resumenSheet.columns = [
    { header: 'Indicador', key: 'indicador', width: 28 },
    { header: 'Valor', key: 'valor', width: 16 },
  ];
  resumenSheet.addRows([
    { indicador: 'Clases programadas', valor: data.totalProgramadas },
    { indicador: 'Registros', valor: data.totalRegistros },
    { indicador: 'Presentes', valor: data.presentes },
    { indicador: 'Puntuales', valor: data.puntual },
    { indicador: 'Tardanzas', valor: data.tardanza },
    { indicador: 'Ausentes', valor: data.ausente },
    { indicador: 'Justificados', valor: data.justificado },
  ]);

  const registrosSheet = workbook.addWorksheet('Registros');
  registrosSheet.columns = [
    { header: 'ID', key: 'id', width: 38 },
    { header: 'Docente', key: 'docente', width: 28 },
    { header: 'Email', key: 'email', width: 34 },
    { header: 'Carrera', key: 'carrera', width: 24 },
    { header: 'Materia', key: 'materia', width: 32 },
    { header: 'Ciclo', key: 'ciclo', width: 14 },
    { header: 'Período académico', key: 'periodo_academico', width: 26 },
    { header: 'Día', key: 'dia', width: 14 },
    { header: 'Horario', key: 'horario', width: 16 },
    { header: 'Entrada', key: 'entrada', width: 20 },
    { header: 'Salida', key: 'salida', width: 20 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Justificación', key: 'justificacion', width: 36 },
    { header: 'IP entrada', key: 'ip_entrada', width: 18 },
    { header: 'Foto entrada', key: 'foto_entrada_url', width: 34 },
    { header: 'Foto salida', key: 'foto_salida_url', width: 34 },
    { header: 'Latitud entrada', key: 'lat_entrada', width: 16 },
    { header: 'Longitud entrada', key: 'lng_entrada', width: 16 },
    { header: 'Precisión entrada m', key: 'precision_entrada_m', width: 18 },
    { header: 'Latitud salida', key: 'lat_salida', width: 16 },
    { header: 'Longitud salida', key: 'lng_salida', width: 16 },
    { header: 'Precisión salida m', key: 'precision_salida_m', width: 18 },
  ];
  registrosSheet.addRows(data.registros);

  [resumenSheet, registrosSheet].forEach((sheet) => {
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B3358' },
    };
    sheet.getRow(1).alignment = { vertical: 'middle' };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
