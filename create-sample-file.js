const XLSX = require('xlsx');

// Create sample data in the exact column sequence as specified
const sampleData = [
  {
    Client: "Example Client 1",
    EmployeeCode: "EMP-1001",
    Name: "John Doe",
    Gender: "Male",
    DOB: "10-05-1990",
    DateOfJoining: "15-07-2026",
    MobileNo: "9876543210",
    Address: "123 Main Street, Mumbai",
    SalaryRate: 500,
    OTRate: 2.0,
    Aadhar_No: "1234 5678 9012",
    PAN_No: "ABCDE1234F",
    BankAccountNo: "12345678901",
    IFSC_Code: "SBIN0001234",
    BankName: "State Bank of India",
    Branch: "Mumbai",
    ESIC_No: "1234567890",
    UAN_No: "123456789012",
    Unifrom: "Yes",
    DocumentStatus: "Pending",
    DateofExit: "",
    ExitReason: ""
  },
  {
    Client: "Example Client 1",
    EmployeeCode: "EMP-1002",
    Name: "Jane Smith",
    Gender: "Female",
    DOB: "15-08-1992",
    DateOfJoining: "20-07-2026",
    MobileNo: "9876543211",
    Address: "456 Park Avenue, Delhi",
    SalaryRate: 600,
    OTRate: 2.0,
    Aadhar_No: "2345 6789 0123",
    PAN_No: "FGHIJ5678K",
    BankAccountNo: "23456789012",
    IFSC_Code: "HDFC0000123",
    BankName: "HDFC Bank",
    Branch: "Delhi",
    ESIC_No: "2345678901",
    UAN_No: "234567890123",
    Unifrom: "No",
    DocumentStatus: "Submitted",
    DateofExit: "",
    ExitReason: ""
  },
  {
    Client: "Example Client 2",
    EmployeeCode: "EMP-2001",
    Name: "Raj Kumar",
    Gender: "Male",
    DOB: "20-03-1988",
    DateOfJoining: "01-07-2026",
    MobileNo: "9876543212",
    Address: "789 MG Road, Bangalore",
    SalaryRate: 550,
    OTRate: 1.5,
    Aadhar_No: "3456 7890 1234",
    PAN_No: "LMNOP9012Q",
    BankAccountNo: "34567890123",
    IFSC_Code: "ICIC0000456",
    BankName: "ICICI Bank",
    Branch: "Bangalore",
    ESIC_No: "3456789012",
    UAN_No: "345678901234",
    Unifrom: "Yes",
    DocumentStatus: "Verified",
    DateofExit: "",
    ExitReason: ""
  }
];

// Create workbook
const wb = XLSX.utils.book_new();

// Create main data sheet with proper column order
const ws = XLSX.utils.json_to_sheet(sampleData);

// Add instructions sheet
const instructionsData = [
  ["IMPORTANT INSTRUCTIONS FOR EMPLOYEE BULK UPLOAD"],
  [],
  ["REQUIRED COLUMNS:"],
  ["• Client - Client name (must exist in system)"],
  ["• Name - Employee full name"],
  ["• DateOfJoining - Format: DD-MM-YYYY"],
  ["• SalaryRate - Daily/Monthly salary rate (number)"],
  [],
  ["OPTIONAL COLUMNS:"],
  ["• EmployeeCode - Unique code (if blank, auto-generated like EMP-0001)"],
  ["• Gender - 'Male' or 'Female'"],
  ["• DOB - Date of birth (DD-MM-YYYY)"],
  ["• MobileNo - 10-digit mobile number"],
  ["• Address - Full address"],
  ["• OTRate - OT multiplier (default: 2.0)"],
  ["• Aadhar_No - Aadhar number (with or without spaces)"],
  ["• PAN_No - PAN number"],
  ["• BankAccountNo - Bank account number"],
  ["• IFSC_Code - Bank IFSC code"],
  ["• BankName - Bank name"],
  ["• Branch - Branch/location"],
  ["• ESIC_No - ESIC number"],
  ["• UAN_No - UAN number"],
  ["• Unifrom - 'Yes' or 'No' (safety apron)"],
  ["• DocumentStatus - 'Pending', 'Submitted', 'Verified' (default: 'Pending')"],
  ["• DateofExit - For exited employees (DD-MM-YYYY)"],
  ["• ExitReason - Reason for leaving"],
  [],
  ["FORMAT NOTES:"],
  ["• Date format must be DD-MM-YYYY"],
  ["• SalaryRate must be a number"],
  ["• OTRate must be a number"],
  ["• MobileNo should be 10 digits"],
  ["• DocumentStatus is case-sensitive"],
  [],
  ["UPLOAD STEPS:"],
  ["1. Download this template"],
  ["2. Fill in employee data"],
  ["3. Save as .xlsx or .csv format"],
  ["4. Go to Employees page → Import Excel"],
  ["5. Select your file and upload"],
  ["6. Check for any error messages"],
  [],
  ["NOTES:"],
  ["• EmployeeCode: Leave blank for auto-generation (EMP-0001, EMP-0002, etc.)"],
  ["• Client: Must match exactly with client name in system"],
  ["• DocumentStatus: Defaults to 'Pending' if left blank"],
  ["• Unifrom: Refers to Safety Apron issued status"],
  ["• For Active employees: Leave DateofExit and ExitReason blank"],
  ["• For Exited employees: Fill DateofExit and ExitReason"]
];

const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);

// Set column width for instructions
wsInstructions['!cols'] = [{ wch: 60 }];

// Add sheets to workbook
XLSX.utils.book_append_sheet(wb, ws, 'Employee Data');
XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

// Write file
XLSX.writeFile(wb, 'employee_upload_template.xlsx');

console.log('✅ Employee upload template created: employee_upload_template.xlsx');
console.log('📋 Columns in order:');
console.log('   1. Client          8. Address       15. BankName     22. ExitReason');
console.log('   2. EmployeeCode    9. SalaryRate    16. Branch');
console.log('   3. Name           10. OTRate        17. ESIC_No');
console.log('   4. Gender         11. Aadhar_No     18. UAN_No');
console.log('   5. DOB            12. PAN_No        19. Unifrom');
console.log('   6. DateOfJoining  13. BankAccountNo 20. DocumentStatus');
console.log('   7. MobileNo       14. IFSC_Code     21. DateofExit');