import PDFDocument from 'pdfkit';
import { formatDateTime, formatLocation, googleMapsUrl } from './reportes.format';
import type { ReportRow, ReportSummaryData } from './reportes.types';

function drawPdfFooter(document: PDFKit.PDFDocument): void {
  const bottom = document.page.height - 34;
  document
    .save()
    .moveTo(40, bottom - 8)
    .lineTo(document.page.width - 40, bottom - 8)
    .strokeColor('#e2e8f0')
    .lineWidth(1)
    .stroke()
    .fillColor('#64748b')
    .fontSize(8)
    .text('Sistema de Asistencia Virtual Docente - ISTL', 40, bottom, {
      width: document.page.width - 80,
      align: 'left',
    })
    .text(`Página ${document.bufferedPageRange().count}`, 40, bottom, {
      width: document.page.width - 80,
      align: 'right',
    })
    .restore();
}

function addPdfPage(document: PDFKit.PDFDocument): void {
  drawPdfFooter(document);
  document.addPage();
}

function drawPdfHeader(document: PDFKit.PDFDocument, data: ReportSummaryData): void {
  document
    .fillColor('#0b3358')
    .fontSize(18)
    .text('Instituto Superior Tecnológico Loja', 40, 38, { width: 360 });
  document
    .fillColor('#0f766e')
    .fontSize(10)
    .text('Sistema de Asistencia Virtual Docente', 40, 62, { width: 360 });

  document
    .fillColor('#111827')
    .fontSize(11)
    .text(data.tipo === 'administrativa' ? 'Reporte de Jornada Administrativa' : 'Reporte de Asistencia Docente', 360, 40, {
      width: 195,
      align: 'right',
    });
  document
    .fillColor('#64748b')
    .fontSize(8)
    .text(`Generado: ${formatDateTime(new Date())}`, 360, 58, {
      width: 195,
      align: 'right',
    });

  document
    .moveTo(40, 86)
    .lineTo(document.page.width - 40, 86)
    .strokeColor('#0b3358')
    .lineWidth(1.4)
    .stroke();

  document
    .fillColor('#475569')
    .fontSize(9)
    .text(
      `Periodo: ${formatDateTime(new Date(data.periodo.fecha_inicio))} - ${formatDateTime(new Date(data.periodo.fecha_fin))}`,
      40,
      98,
      { width: document.page.width - 80 }
    );
}

function drawSummaryCards(document: PDFKit.PDFDocument, data: ReportSummaryData): void {
  const cards = [
    ['Programadas', data.totalProgramadas],
    ['Registros', data.totalRegistros],
    ['Presentes', data.presentes],
    ['Puntuales', data.puntual],
    ['Tardanzas', data.tardanza],
    ['Ausentes', data.ausente],
    ['Justificados', data.justificado],
  ];
  const startX = 40;
  const startY = 126;
  const gap = 8;
  const width = 68;
  const height = 44;

  cards.forEach(([label, value], index) => {
    const x = startX + index * (width + gap);
    document
      .roundedRect(x, startY, width, height, 4)
      .fillAndStroke('#f8fafc', '#dbe5ef')
      .fillColor('#0b3358')
      .fontSize(14)
      .text(String(value), x + 8, startY + 8, { width: width - 16, align: 'center' })
      .fillColor('#64748b')
      .fontSize(7)
      .text(String(label), x + 5, startY + 28, { width: width - 10, align: 'center' });
  });
}

function drawTableHeader(document: PDFKit.PDFDocument, y: number): void {
  document
    .rect(40, y, document.page.width - 80, 20)
    .fill('#0b3358')
    .fillColor('#ffffff')
    .fontSize(7.5)
    .text('Docente', 46, y + 6, { width: 100 })
    .text('Materia', 148, y + 6, { width: 102 })
    .text('Horario', 252, y + 6, { width: 70 })
    .text('Entrada', 324, y + 6, { width: 70 })
    .text('Salida', 396, y + 6, { width: 58 })
    .text('Estado', 456, y + 6, { width: 48 })
    .text('GPS', 506, y + 6, { width: 48 });
}

function drawReportRow(document: PDFKit.PDFDocument, row: ReportRow, y: number, shaded: boolean): number {
  const rowHeight = 38;
  const background = shaded ? '#f8fafc' : '#ffffff';
  const mapUrl = googleMapsUrl(row);

  document.rect(40, y, document.page.width - 80, rowHeight).fillAndStroke(background, '#e2e8f0');
  document
    .fillColor('#111827')
    .fontSize(7.2)
    .text(row.docente, 46, y + 6, { width: 98, height: 24 })
    .text(`${row.materia} (${row.paralelo})`, 148, y + 6, { width: 100, height: 24 })
    .text(row.horario, 252, y + 6, { width: 68 })
    .text(row.entrada || '-', 324, y + 6, { width: 70 })
    .text(row.salida || '-', 396, y + 6, { width: 58 })
    .text(row.estado, 456, y + 6, { width: 48 })
    .text(formatLocation(row), 506, y + 6, { width: 48, height: 18 });

  if (mapUrl) {
    document
      .fillColor('#0f766e')
      .fontSize(7)
      .text('Mapa', 506, y + 24, { width: 48, link: mapUrl, underline: true });
  }

  return y + rowHeight;
}

export function renderReportPdf(data: ReportSummaryData): Promise<Buffer> {
  const document = new PDFDocument({ autoFirstPage: false, bufferPages: true, margin: 40, size: 'A4' });
  const chunks: Buffer[] = [];

  document.on('data', (chunk: Buffer) => chunks.push(chunk));

  document.addPage();
  drawPdfHeader(document, data);
  drawSummaryCards(document, data);
  document.fillColor('#0b3358').fontSize(12).text('Detalle de marcaciones', 40, 194);

  let y = 216;
  drawTableHeader(document, y);
  y += 20;

  if (data.registros.length === 0) {
    document
      .fillColor('#64748b')
      .fontSize(10)
      .text('No existen registros para los filtros seleccionados.', 40, y + 12, {
        width: document.page.width - 80,
      });
  } else {
    data.registros.forEach((row, index) => {
      if (y > document.page.height - 84) {
        addPdfPage(document);
        drawPdfHeader(document, data);
        document.fillColor('#0b3358').fontSize(12).text('Detalle de marcaciones', 40, 126);
        y = 148;
        drawTableHeader(document, y);
        y += 20;
      }

      y = drawReportRow(document, row, y, index % 2 === 0);
    });
  }

  drawPdfFooter(document);
  document.end();

  return new Promise((resolve) => {
    document.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
