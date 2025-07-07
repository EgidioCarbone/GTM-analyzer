// src/pages/PlanPage.tsx
import React, { useState } from "react";
import { useContainer } from "../context/ContainerContext";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  TextRun
} from "docx";



type Parameter = { key: string; value: string };
type GTMItem = {
  name: string;
  type: string;
  parameter?: Parameter[];
};

export default function PlanPage() {
  const { container } = useContainer();
  const [clientName, setClientName] = useState("");
  const [language, setLanguage] = useState<"it" | "en">("it");

  const containerId = container?.containerId || "00000000";
  const publicId = `GTM-${containerId.slice(-7)}`;
  const now = format(new Date(), "d MMMM yyyy 'alle' HH:mm");

  const translate = (it: string, en: string) => (language === "it" ? it : en);

  const getDescription = (type: string): string =>
    ({
      ga4Event: translate("Evento GA4 personalizzato", "Custom GA4 Event"),
      html: translate("Tag HTML custom", "Custom HTML Tag"),
      trigger: translate("Attivatore", "Trigger"),
      variable: translate("Variabile GTM", "GTM Variable"),
    }[type] || translate("Elemento tecnico", "Technical item"));

  const getParamDescription = (key: string): string =>
    ({
      eventName: translate("Nome dell'evento GA4", "GA4 event name"),
      items: translate("Oggetto dei prodotti", "Items object"),
      value: translate("Valore dell'evento", "Event value"),
      send_to: translate("Destinazione", "Send to destination"),
    }[key] || translate("Parametro tecnico", "Technical parameter"));

  const exportToPDF = async () => {
    const element = document.getElementById("plan-preview");
    if (!element) return;
    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    pdf.addImage(imgData, "PNG", 10, 10, 190, 0);
    pdf.save(`PianoMisurazione_${publicId}.pdf`);
  };

const exportToWord = async () => {
const sections: (Paragraph | Table)[] = []; 

  // Header
  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: translate("📊 Piano di Misurazione", "📊 Measurement Plan"),
          bold: true,
          size: 32,
          color: "1F4E79", // Blu scuro
        }),
      ],
      spacing: { after: 300 },
    }),
    new Paragraph(`${translate("Cliente", "Client")}: ${clientName}`),
    new Paragraph(`${translate("Contenitore", "Container")}: ${publicId}`),
    new Paragraph(`${translate("Generato il", "Generated on")}: ${now}`),
    new Paragraph("") // Spazio
  );

  // Tabella parametri
  const renderTable = (params: { key: string; value: string }[]) => {
    return new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "Parametro", bold: true })],
              })],
              shading: { fill: "D9E1F2" },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "A6A6A6" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "A6A6A6" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "A6A6A6" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "A6A6A6" },
              },
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "Descrizione", bold: true })],
              })],
              shading: { fill: "D9E1F2" },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "A6A6A6" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "A6A6A6" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "A6A6A6" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "A6A6A6" },
              },
            }),
          ],
        }),
        ...params.map((param) =>
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph(param.key)],
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                  left: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                  right: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                },
              }),
              new TableCell({
                children: [new Paragraph(getParamDescription(param.key))],
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                  left: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                  right: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                },
              }),
            ],
          })
        ),
      ],
    });
  };

  const renderSection = (title: string, items: GTMItem[]) => {
    sections.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
        thematicBreak: true,
      })
    );

    items.forEach((item) => {
      sections.push(
        new Paragraph({
          text: item.name,
          heading: HeadingLevel.HEADING_3,
          spacing: { after: 100 },
        }),
        new Paragraph(
          `${translate("Descrizione", "Description")}: ${getDescription(item.type)}`
        )
      );

      if (item.parameter?.length) {
        sections.push(renderTable(item.parameter));
      }

      sections.push(new Paragraph("")); // spazio
    });
  };

  renderSection("🎯 TAG", container?.tag || []);
  renderSection("⚡ TRIGGER", container?.trigger || []);
  renderSection("🧩 VARIABILI", container?.variable || []);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 1 inch
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: sections,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `PianoMisurazione_${publicId}.docx`);
};


  const renderSection = (
    title: string,
    items: GTMItem[] | undefined,
    emoji: string
  ) => (
    <section>
      <h2 className="text-xl font-bold mt-8 mb-3">{emoji} {title}</h2>
      {items?.map((item, idx) => (
        <div key={idx} className="border rounded-xl p-4 bg-white shadow mb-4">
          <h3 className="text-lg font-semibold">{item.name}</h3>
          <p className="text-sm text-gray-700">
            {translate("Tipo", "Type")}: {item.type}
          </p>
          <p className="text-sm text-gray-600 italic mb-2">
            {getDescription(item.type)}
          </p>

          {item.parameter?.length ? (
            <table className="text-sm w-full border mt-2">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1 text-left">
                    {translate("Parametro", "Parameter")}
                  </th>
                  <th className="border px-2 py-1 text-left">
                    {translate("Descrizione", "Description")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {item.parameter.map((param: Parameter, pidx: number) => (
                  <tr key={pidx}>
                    <td className="border px-2 py-1">{param.key}</td>
                    <td className="border px-2 py-1">
                      {getParamDescription(param.key)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm italic text-gray-400 mt-1">
              {translate("Nessun parametro", "No parameters")}
            </p>
          )}
        </div>
      ))}
    </section>
  );

  const countItems = (arr: GTMItem[] | undefined) =>
    arr?.length || 0;

  const countByType = (arr: GTMItem[] | undefined) => {
    const result: Record<string, number> = {};
    arr?.forEach((item) => {
      result[item.type] = (result[item.type] || 0) + 1;
    });
    return result;
  };

  const renderTypeCount = (types: Record<string, number>) =>
    Object.entries(types).map(([type, count], idx) => (
      <span
        key={idx}
        className="text-xs bg-gray-200 px-2 py-1 rounded-full mr-2"
      >
        {type}: {count}
      </span>
    ));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">📊 Piano di Misurazione</h1>
          <p className="text-gray-500">
            {translate("Documento completo del contenitore", "Full container report")}{" "}
            <strong>{publicId}</strong>
          </p>
        </div>
        <div className="space-x-2">
          <button onClick={exportToPDF} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">PDF</button>
          <button onClick={exportToWord} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Word</button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <input
          type="text"
          placeholder={translate("Nome Cliente", "Client Name")}
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          className="border px-4 py-2 rounded w-64"
        />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as "it" | "en")}
          className="border px-2 py-2 rounded"
        >
          <option value="it">🇮🇹 Italiano</option>
          <option value="en">🇬🇧 English</option>
        </select>
      </div>

      <div className="bg-gray-50 p-4 rounded shadow">
        <h2 className="text-lg font-bold mb-2">
          {translate("Informazioni Contenitore", "Container Info")}
        </h2>
        <p><strong>ID:</strong> {containerId}</p>
        <p><strong>Public ID:</strong> {publicId}</p>
        <p><strong>{translate("Generato il", "Generated on")}:</strong> {now}</p>
        <p><strong>{translate("Cliente", "Client")}:</strong> {clientName || "-"}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-xl font-bold text-blue-600">
            {countItems(container?.tag)}
          </h3>
          <p className="text-gray-700 font-medium mb-1">Tag</p>
          {renderTypeCount(countByType(container?.tag))}
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-xl font-bold text-green-600">
            {countItems(container?.trigger)}
          </h3>
          <p className="text-gray-700 font-medium mb-1">Trigger</p>
          {renderTypeCount(countByType(container?.trigger))}
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-xl font-bold text-purple-600">
            {countItems(container?.variable)}
          </h3>
          <p className="text-gray-700 font-medium mb-1">Variabili</p>
          {renderTypeCount(countByType(container?.variable))}
        </div>
      </div>

      <div id="plan-preview" className="space-y-6">
        {renderSection("TAG", container?.tag, "🎯")}
        {renderSection("TRIGGER", container?.trigger, "⚡")}
        {renderSection("VARIABILI", container?.variable, "🧩")}
      </div>
    </div>
  );
}
