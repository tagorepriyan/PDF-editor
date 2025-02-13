import React, { useState, useCallback } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { searchPlugin } from '@react-pdf-viewer/search';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { zoomPlugin } from '@react-pdf-viewer/zoom';
import { useDropzone } from 'react-dropzone';
import { FileUp, Upload, Download, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface TemplateField {
  x: number;
  y: number;
  fieldName: string;
}

const PDFViewer: React.FC = () => {
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [isTemplateMode, setIsTemplateMode] = useState(false);
  const [templatePdfBytes, setTemplatePdfBytes] = useState<ArrayBuffer | null>(null);

  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const searchPluginInstance = searchPlugin();
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const zoomPluginInstance = zoomPlugin();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
    },
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        const fileUrl = URL.createObjectURL(file);
        setPdfFile(fileUrl);

        // If in template mode, store the PDF bytes for later use
        if (isTemplateMode) {
          const arrayBuffer = await file.arrayBuffer();
          setTemplatePdfBytes(arrayBuffer);
        }
      }
    },
  });

  const handleCSVUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        complete: (results) => {
          setCsvData(results.data);
        },
        header: true,
      });
    }
  }, []);

  const handleTemplateFieldAdd = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isTemplateMode) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    const fieldName = prompt('Enter field name (should match CSV column header):');
    if (fieldName) {
      setTemplateFields((prev) => [...prev, { x, y, fieldName }]);
    }
  }, [isTemplateMode]);

  const generatePDFs = async () => {
    if (!templatePdfBytes || !csvData.length || !templateFields.length) {
      alert('Please ensure you have a template PDF, CSV data, and template fields set');
      return;
    }

    try {
      const pdfDoc = await PDFDocument.load(templatePdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const page = pdfDoc.getPages()[0];
      const { width, height } = page.getSize();

      // Generate a PDF for each row in the CSV
      for (const row of csvData) {
        const newPdf = await PDFDocument.load(templatePdfBytes);
        const newPage = newPdf.getPages()[0];

        // Add text for each template field
        for (const field of templateFields) {
          const text = row[field.fieldName] || '';
          newPage.drawText(text, {
            x: (field.x / 100) * width,
            y: height - (field.y / 100) * height, // Flip Y coordinate
            size: 12,
            font: await newPdf.embedFont(StandardFonts.Helvetica),
            color: rgb(0, 0, 0),
          });
        }

        // Save and download the generated PDF
        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `generated_${row[Object.keys(row)[0]]}.pdf`; // Use first column as filename
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error generating PDFs:', error);
      alert('Error generating PDFs. Please check the console for details.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 bg-white shadow-sm mb-4 flex items-center space-x-4">
        <button
          onClick={() => setIsTemplateMode(!isTemplateMode)}
          className={`px-4 py-2 rounded-lg ${
            isTemplateMode
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Template Mode
        </button>
        {isTemplateMode && (
          <>
            <label className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg cursor-pointer">
              <FileSpreadsheet className="w-5 h-5" />
              <span>Upload CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={generatePDFs}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center space-x-2"
              disabled={!templatePdfBytes || !csvData.length || !templateFields.length}
            >
              <Download className="w-5 h-5" />
              <span>Generate PDFs</span>
            </button>
          </>
        )}
      </div>

      {!pdfFile ? (
        <div
          {...getRootProps()}
          className="h-96 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg mx-4 my-8 cursor-pointer hover:border-blue-500 transition-colors"
        >
          <input {...getInputProps()} />
          <div className="text-center">
            <FileUp className="w-12 h-12 mx-auto text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              {isDragActive
                ? 'Drop the PDF file here'
                : `${isTemplateMode ? 'Upload template PDF' : 'Drag and drop a PDF file here, or click to select one'}`}
            </p>
          </div>
        </div>
      ) : (
        <div 
          className="h-screen relative" 
          style={{ '--scale-factor': 1 } as React.CSSProperties}
          onClick={isTemplateMode ? handleTemplateFieldAdd : undefined}
        >
          <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
            <Viewer
              fileUrl={pdfFile}
              plugins={[
                defaultLayoutPluginInstance,
                searchPluginInstance,
                pageNavigationPluginInstance,
                zoomPluginInstance,
              ]}
            />
          </Worker>
          {isTemplateMode && templateFields.map((field, index) => (
            <div
              key={index}
              className="absolute w-2 h-2 bg-blue-500 rounded-full transform -translate-x-1 -translate-y-1 cursor-pointer"
              style={{ left: `${field.x}%`, top: `${field.y}%` }}
              title={field.fieldName}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PDFViewer;