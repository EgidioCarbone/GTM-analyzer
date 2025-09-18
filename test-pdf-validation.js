#!/usr/bin/env node
/**
 * Test script per verificare la validazione PDF
 * Usage: node test-pdf-validation.js <path-to-pdf-file>
 */

import fs from 'fs/promises';
import { validatePDFFile } from './src/services/pdfTextExtraction.js';

async function testPDFValidation(filePath) {
  console.log(`🔍 Testing PDF validation for: ${filePath}`);
  console.log('=' .repeat(50));

  try {
    // Check if file exists
    const stats = await fs.stat(filePath);
    console.log(`📁 File exists: ✅`);
    console.log(`📏 File size: ${stats.size} bytes (${Math.round(stats.size / 1024 / 1024 * 100) / 100} MB)`);
    
    // Check file extension
    const isPdfExtension = filePath.toLowerCase().endsWith('.pdf');
    console.log(`📄 PDF extension: ${isPdfExtension ? '✅' : '❌'}`);
    
    // Check PDF signature
    const fileBuffer = await fs.readFile(filePath);
    const pdfSignature = fileBuffer.subarray(0, 4).toString();
    const firstBytes = fileBuffer.subarray(0, 16).toString('hex');
    
    console.log(`🔐 PDF signature: ${pdfSignature} ${pdfSignature === '%PDF' ? '✅' : '❌'}`);
    console.log(`🔢 First 16 bytes (hex): ${firstBytes}`);
    
    // Test our validation function
    console.log('\n🧪 Testing validation function...');
    await validatePDFFile(filePath, 10 * 1024 * 1024); // 10MB limit
    console.log('✅ PDF validation passed!');
    
  } catch (error) {
    console.log('❌ PDF validation failed:');
    console.log(`   Error: ${error.message}`);
    console.log(`   Code: ${error.code || 'UNKNOWN'}`);
    
    // Provide suggestions
    if (error.message.includes('ZIP')) {
      console.log('\n💡 Suggestion: This appears to be a ZIP file. Try:');
      console.log('   - Export as PDF from PowerPoint/Word');
      console.log('   - Use "Save As PDF" instead of "Save"');
    } else if (error.message.includes('image')) {
      console.log('\n💡 Suggestion: This appears to be an image. Try:');
      console.log('   - Convert image to PDF using online tools');
      console.log('   - Use a PDF printer to create PDF from image');
    } else if (error.message.includes('HTML')) {
      console.log('\n💡 Suggestion: This appears to be HTML. Try:');
      console.log('   - Print to PDF from browser');
      console.log('   - Use browser "Save as PDF" feature');
    }
  }
}

// Get file path from command line arguments
const filePath = process.argv[2];
if (!filePath) {
  console.log('Usage: node test-pdf-validation.js <path-to-pdf-file>');
  console.log('Example: node test-pdf-validation.js test.pdf');
  process.exit(1);
}

testPDFValidation(filePath).catch(console.error);
