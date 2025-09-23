import React from 'react';
import { Upload, FileText, RefreshCw, Loader2, XCircle } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { UploadStepProps } from '../../types/ssd';

export default function UploadStep({
  state,
  ssdConfig,
  configLoading,
  configError,
  onFileUpload,
  onUrlChange,
  onIngest
}: UploadStepProps) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Upload PDF and Target URL</h2>
      <p className="text-sm text-gray-600 mb-6">
        Upload your PDF specification and the system will automatically process it and run the tests.
      </p>
      
      {/* Configuration Loading State */}
      {configLoading && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center">
            <Loader2 className="w-4 h-4 text-blue-600 mr-2 animate-spin" />
            <p className="text-sm text-blue-800">Loading configuration...</p>
          </div>
        </div>
      )}
      
      {/* Configuration Error */}
      {configError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <XCircle className="w-4 h-4 text-red-600 mr-2" />
            <p className="text-sm text-red-800">Failed to load configuration: {configError}</p>
          </div>
        </div>
      )}
      
      {/* Configuration Info */}
      {ssdConfig && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center justify-between text-sm text-green-800">
            <span>Max file size: {ssdConfig.maxFileSizeMB} MB</span>
            <span>Supported: {ssdConfig.supportedFormats.join(', ')}</span>
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        {/* URL Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Website URL
          </label>
          <Input
            type="url"
            placeholder="https://fibra.aruba.it"
            value={state.url}
            onChange={(e) => onUrlChange(e.target.value)}
            className="w-full"
          />
        </div>

        {/* PDF Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            SSD PDF Document
          </label>
          <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
            state.pdfFile 
              ? 'border-green-400 bg-green-50' 
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
          }`}>
            <FileText className={`w-16 h-16 mx-auto mb-4 ${
              state.pdfFile ? 'text-green-500' : 'text-gray-400'
            }`} />
            <div className="space-y-3">
              <p className={`text-sm font-medium ${
                state.pdfFile ? 'text-green-700' : 'text-gray-600'
              }`}>
                {state.pdfFile ? state.pdfFile.name : 'Click to upload PDF or drag and drop'}
              </p>
              {state.pdfFile && (
                <p className="text-xs text-green-600">
                  ✓ PDF ready for processing
                </p>
              )}
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => e.target.files?.[0] && onFileUpload(e.target.files[0])}
                className="hidden"
                id="pdf-upload"
              />
              <label
                htmlFor="pdf-upload"
                className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors duration-200"
              >
                {state.pdfFile ? 'Change File' : 'Choose File'}
              </label>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <XCircle className="w-5 h-5 text-red-400 mr-2" />
              <p className="text-sm text-red-800">{state.error}</p>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-center">
          <Button
            onClick={onIngest}
            disabled={!state.url || !state.pdfFile || state.isLoading || !ssdConfig || configLoading}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {state.isLoading ? (
              <RefreshCw className="w-5 h-5 mr-3 animate-spin" />
            ) : (
              <FileText className="w-5 h-5 mr-3" />
            )}
            {state.isLoading ? 'Processing PDF & Running Tests...' : 'Process PDF & Run Tests'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
