import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

/**
 * Excel Import/Export Service
 * Handles reading and writing Excel files for ERP data
 */

/**
 * Read Excel file and convert to JSON
 * @param {string} filePath - Path to the Excel file
 * @param {Object} options - Parsing options
 * @returns {Array} Array of objects representing rows
 */
export const readExcel = (filePath, options = {}) => {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = options.sheetName || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const data = XLSX.utils.sheet_to_json(worksheet, {
            raw: options.raw ?? false,
            defval: options.defaultValue ?? '',
            header: options.header,
            range: options.range,
        });

        return {
            success: true,
            data,
            sheetName,
            totalRows: data.length,
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Read Excel from buffer (for file uploads)
 * @param {Buffer} buffer - File buffer
 * @param {Object} options - Parsing options
 * @returns {Array} Array of objects representing rows
 */
export const readExcelFromBuffer = (buffer, options = {}) => {
    try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = options.sheetName || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const data = XLSX.utils.sheet_to_json(worksheet, {
            raw: options.raw ?? false,
            defval: options.defaultValue ?? '',
        });

        return {
            success: true,
            data,
            sheetName,
            sheetNames: workbook.SheetNames,
            totalRows: data.length,
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Export data to Excel buffer
 * @param {Array} data - Array of objects to export
 * @param {Object} options - Export options
 * @returns {Buffer} Excel file buffer
 */
export const exportToExcel = (data, options = {}) => {
    try {
        const worksheet = XLSX.utils.json_to_sheet(data, {
            header: options.columns,
            skipHeader: options.skipHeader ?? false,
        });

        // Set column widths if provided
        if (options.columnWidths) {
            worksheet['!cols'] = options.columnWidths.map(width => ({ wch: width }));
        }

        // Auto-fit column widths
        if (options.autoFitColumns) {
            const maxWidth = 50;
            const colWidths = [];

            if (data.length > 0) {
                const headers = Object.keys(data[0]);
                headers.forEach((header, i) => {
                    let maxLen = header.length;
                    data.forEach(row => {
                        const cellValue = String(row[header] || '');
                        maxLen = Math.max(maxLen, cellValue.length);
                    });
                    colWidths.push({ wch: Math.min(maxLen + 2, maxWidth) });
                });
                worksheet['!cols'] = colWidths;
            }
        }

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName || 'Data');

        // Add additional sheets if provided
        if (options.additionalSheets) {
            options.additionalSheets.forEach(sheet => {
                const ws = XLSX.utils.json_to_sheet(sheet.data);
                XLSX.utils.book_append_sheet(workbook, ws, sheet.name);
            });
        }

        const buffer = XLSX.write(workbook, {
            type: 'buffer',
            bookType: options.bookType || 'xlsx',
        });

        return {
            success: true,
            buffer,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Export data to Excel file
 * @param {Array} data - Array of objects to export
 * @param {string} filePath - Path to save the file
 * @param {Object} options - Export options
 */
export const exportToExcelFile = (data, filePath, options = {}) => {
    try {
        const result = exportToExcel(data, options);
        if (!result.success) {
            return result;
        }

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, result.buffer);

        return {
            success: true,
            filePath,
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Template definitions for common ERP imports
 */
export const IMPORT_TEMPLATES = {
    ITEMS: {
        columns: ['name', 'sku', 'description', 'costType', 'defaultUnitPrice', 'units', 'category'],
        required: ['name', 'costType'],
        validators: {
            costType: (val) => ['Material', 'Labour', 'Transport', 'Product', 'Service'].includes(val),
            defaultUnitPrice: (val) => !val || !isNaN(parseInt(val)),
        },
    },
    VENDORS: {
        columns: ['name', 'contactPhone', 'contactEmail', 'address', 'gst', 'paymentTerms'],
        required: ['name'],
    },
    ESTIMATES: {
        columns: ['clientName', 'itemName', 'qty', 'unit', 'unitPrice', 'notes'],
        required: ['clientName', 'itemName', 'qty', 'unit', 'unitPrice'],
    },
    STOCK: {
        columns: ['itemName', 'warehouseName', 'quantity', 'unit', 'batch', 'notes'],
        required: ['itemName', 'warehouseName', 'quantity', 'unit'],
    },
};

/**
 * Validate imported data against template
 * @param {Array} data - Imported data
 * @param {string} templateName - Name of the template
 * @returns {Object} Validation result
 */
export const validateImportData = (data, templateName) => {
    const template = IMPORT_TEMPLATES[templateName];
    if (!template) {
        return {
            success: false,
            error: `Unknown template: ${templateName}`,
        };
    }

    const errors = [];
    const validRows = [];

    data.forEach((row, index) => {
        const rowErrors = [];

        // Check required fields
        template.required.forEach(field => {
            if (!row[field] || String(row[field]).trim() === '') {
                rowErrors.push(`Row ${index + 2}: Missing required field '${field}'`);
            }
        });

        // Run custom validators
        if (template.validators) {
            Object.entries(template.validators).forEach(([field, validator]) => {
                if (row[field] && !validator(row[field])) {
                    rowErrors.push(`Row ${index + 2}: Invalid value for '${field}'`);
                }
            });
        }

        if (rowErrors.length > 0) {
            errors.push(...rowErrors);
        } else {
            validRows.push(row);
        }
    });

    return {
        success: errors.length === 0,
        validRows,
        invalidCount: data.length - validRows.length,
        errors,
    };
};

/**
 * Generate sample import template
 * @param {string} templateName - Name of the template
 * @returns {Buffer} Excel file buffer
 */
export const generateImportTemplate = (templateName) => {
    const template = IMPORT_TEMPLATES[templateName];
    if (!template) {
        return {
            success: false,
            error: `Unknown template: ${templateName}`,
        };
    }

    // Create sample row
    const sampleData = [{}];
    template.columns.forEach(col => {
        sampleData[0][col] = template.required.includes(col) ? `<Required>` : `<Optional>`;
    });

    return exportToExcel(sampleData, {
        sheetName: templateName,
        autoFitColumns: true,
    });
};

export default {
    readExcel,
    readExcelFromBuffer,
    exportToExcel,
    exportToExcelFile,
    validateImportData,
    generateImportTemplate,
    IMPORT_TEMPLATES,
};
