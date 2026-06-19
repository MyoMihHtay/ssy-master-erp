import React, { useState, useEffect } from 'react';
import type { Employee, Attendance, Advance, Leave, HRSetting, LateRule, ExpenseItem, AccountItem } from '../App';

interface HRProps {
  userRole: string; userName: string;
  employees: Employee[]; setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  attendance: Attendance[]; setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
  advances: Advance[]; setAdvances: React.Dispatch<React.SetStateAction<Advance[]>>;
  leaves: Leave[]; setLeaves: React.Dispatch<React.SetStateAction<Leave[]>>;
  hrSettings: HRSetting[]; setHrSettings: React.Dispatch<React.SetStateAction<HRSetting[]>>;
  setExpenses: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
  accounts: AccountItem[];
}

const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; const p1 = lat1 * Math.PI/180; const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180; const dl = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); return R * c;
};

const parseTimeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM|am|pm)?/);
  if (!match) return 0;
  let hours = parseInt(match[1]); const minutes = parseInt(match[2]); const period = match[3]?.toUpperCase();
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

export const HR: React.FC<HRProps> = ({ userRole, userName, employees, setEmployees, attendance, setAttendance, advances, setAdvances, leaves, setLeaves, hrSettings, setHrSettings, setExpenses }) => {
  const [activeSubTab, setActiveSubTab] = useState<'attendance' | 'history' | 'employees' | 'advances' | 'leaves' | 'payroll' | 'settings'>('attendance');
  
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [empName, setEmpName] = useState(''); const [empPos, setEmpPos] = useState('');
  const [empDept, setEmpDept] = useState(''); const [empSalary, setEmpSalary] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  
  const [advEmpId, setAdvEmpId] = useState(''); const [advAmount, setAdvAmount] = useState(''); const [advReason, setAdvReason] = useState('');
  
  const [lvEmpId, setLvEmpId] = useState(''); const [lvStart, setLvStart] = useState(''); const [lvEnd, setLvEnd] = useState(''); 
  const [lvType, setLvType] = useState('Sick Leave (နေမကောင်းခွင့်)'); const [lvReason, setLvReason] = useState('');

  const [actionLeave, setActionLeave] = useState<Leave | null>(null);
  const [leaveRemark, setLeaveRemark] = useState('');

  const [payslipData, setPayslipData] = useState<{ emp: Employee, data: any } | null>(null);
  const [extraPays, setExtraPays] = useState<Record<string, { bonus: number; commission: number; }>>({});

  const defaultSetting: HRSetting = hrSettings.find(s => s.id === 'default') || { 
    id: 'default', officeLatitude: 21.9588, officeLongitude: 96.0891, allowedRadius: 50, 
    officeStartTime: '08:30', officeEndTime: '17:30', punctualityBonus: 20000, perfectAttendanceBonus: 30000,
    lateRules: [
      { id: 1, startMin: 1, endMin: 30, deduction: 1000, type: 'amount' },
      { id: 2, startMin: 31, endMin: 60, deduction: 2000, type: 'amount' },
      { id: 3, startMin: 61, endMin: 90, deduction: 3500, type: 'amount' },
      { id: 4, startMin: 91, endMin: 150, deduction: 0, type: 'half_day' },
      { id: 5, startMin: 151, endMin: 999, deduction: 0, type: 'full_day' }
    ]
  };

  const [setLat, setSetLat] = useState(defaultSetting.officeLatitude.toString());
  const [setLon, setSetLon] = useState(defaultSetting.officeLongitude.toString());
  const [setRad, setSetRad] = useState(defaultSetting.allowedRadius.toString());
  const [setStartTime, setSetStartTime] = useState(defaultSetting.officeStartTime);
  const [setEndTime, setSetEndTime] = useState(defaultSetting.officeEndTime);
  const [setPunctuality, setSetPunctuality] = useState(defaultSetting.punctualityBonus.toString());
  const [setPerfect, setSetPerfect] = useState(defaultSetting.perfectAttendanceBonus.toString());
  const [setRules, setSetRules] = useState<LateRule[]>(defaultSetting.lateRules);

  const [currentLoc, setCurrentLoc] = useState<{lat: number, lon: number, accuracy: number} | null>(null);
  const [locError, setLocError] = useState('');

  const isAdminOrHR = userRole === 'md' || userRole === 'manager' || userRole === 'hr';
  const isMD = userRole === 'md';
  const currentEmployee = employees.find(e => e.name.toLowerCase() === userName.toLowerCase() || e.id === userName);
  const today = new Date().toLocaleDateString('en-GB');

  // 🌟 Android အတွက် GPS ပိုမိုတိကျစေရန် 🌟
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => { 
          setCurrentLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }); 
          setLocError(''); 
        },
        (err) => { 
          setLocError('GPS ဖွင့်ရန် သို့မဟုတ် Location ခွင့်ပြုချက် (Allow) ပေးရန် လိုအပ်ပါသည်။'); 
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 } // Add maximumAge & timeout for Android
      );
    } else { 
      setLocError('သင်၏ ဖုန်းသည် GPS စနစ်ကို အထောက်အပံ့မပေးပါ။'); 
    }
  }, []);

  const resetEmpForm = () => { setEditingEmpId(null); setEmpName(''); setEmpPos(''); setEmpDept(''); setEmpSalary(''); setEmpPhone(''); };
  const handleSaveEmployee = (e: React.FormEvent) => { e.preventDefault(); if (editingEmpId) { setEmployees(employees.map(emp => emp.id === editingEmpId ? { ...emp, name: empName, position: empPos, department: empDept, basicSalary: Number(empSalary), phone: empPhone } : emp)); alert('✅ ပြင်ဆင်မှု အောင်မြင်ပါသည်။'); } else { const newEmp: Employee = { id: `EMP-${Date.now()}`, name: empName, position: empPos, department: empDept, basicSalary: Number(empSalary), joinedDate: today, phone: empPhone, status: 'Active' }; setEmployees([...employees, newEmp]); alert('✅ ဝန်ထမ်းအသစ် စာရင်းသွင်းပြီးပါပြီ။'); } resetEmpForm(); };
  const handleEditEmployee = (emp: Employee) => { setEditingEmpId(emp.id); setEmpName(emp.name); setEmpPos(emp.position); setEmpDept(emp.department); setEmpSalary(emp.basicSalary.toString()); setEmpPhone(emp.phone); };
  const handleDeleteEmployee = (id: string) => { if (window.confirm("⚠️ ဤဝန်ထမ်းစာရင်းကို အပြီးတိုင် ဖျက်ပစ်မည်မှာ သေချာပါသလား?")) { setEmployees(employees.filter(e => e.id !== id)); } };

  const handleAddAdvance = (e: React.FormEvent) => { e.preventDefault(); if (!advEmpId || !advAmount) return; setAdvances([{ id: Date.now(), employeeId: advEmpId, date: today, amount: Number(advAmount), reason: advReason, status: 'Approved', deducted: false }, ...advances]); setAdvEmpId(''); setAdvAmount(''); setAdvReason(''); alert('✅ ကြိုတင်ငွေ မှတ်တမ်းတင်ပြီးပါပြီ။ လစာထုတ်ချိန်တွင် အလိုအလျောက် ဖြတ်တောက်ပါမည်။'); };
  
  const handleAddLeave = (e: React.FormEvent) => {
    e.preventDefault(); if (!lvEmpId || !lvStart || !lvEnd) return;
    setLeaves([{ id: Date.now(), employeeId: lvEmpId, startDate: lvStart, endDate: lvEnd, leaveType: lvType, reason: lvReason, status: 'Pending' }, ...leaves]);
    setLvEmpId(''); setLvStart(''); setLvEnd(''); setLvReason(''); 
    alert('✅ ခွင့်တိုင်ကြားခြင်း မှတ်တမ်းတင်ပြီးပါပြီ။ MD/HR မှ အတည်ပြုပေးရန် စောင့်ဆိုင်းပါ။');
  };

  const handleLeaveAction = (status: 'Approved' | 'Rejected') => {
    if (!actionLeave) return;
    setLeaves(leaves.map(l => l.id === actionLeave.id ? { ...l, status, reason: `${l.reason} | 👨‍💼 HR မှတ်ချက်: ${leaveRemark || '-'}` } : l));
    setActionLeave(null); setLeaveRemark('');
  };

  const handleAutoGetGPS = () => { if (currentLoc) { setSetLat(currentLoc.lat.toString()); setSetLon(currentLoc.lon.toString()); alert('✅ လက်ရှိတည်နေရာကို အောင်မြင်စွာ ရယူပြီးပါပြီ။\n(မူဝါဒများ အတည်ပြု သိမ်းဆည်းမည် ကို ဆက်နှိပ်ပါ။)'); } else { alert('⚠️ GPS ရှာဖွေနေဆဲဖြစ်ပါသည် သို့မဟုတ် Location ပိတ်ထားပါသည်။'); } };
  const handleSaveSettings = () => { setHrSettings([{ id: 'default', officeLatitude: Number(setLat), officeLongitude: Number(setLon), allowedRadius: Number(setRad), officeStartTime: setStartTime, officeEndTime: setEndTime, punctualityBonus: Number(setPunctuality), perfectAttendanceBonus: Number(setPerfect), lateRules: setRules }]); alert('✅ မူဝါဒများ သိမ်းဆည်းခြင်း အောင်မြင်ပါသည်။'); };
  
  const handleCheckIn = () => { if (!currentEmployee) return alert('ဝန်ထမ်းစာရင်းတွင် မတွေ့ရှိပါ။'); if (!currentLoc) return alert('GPS ရှာဖွေနေဆဲပါ။'); const distance = getDistanceInMeters(currentLoc.lat, currentLoc.lon, defaultSetting.officeLatitude, defaultSetting.officeLongitude); if (distance > defaultSetting.allowedRadius) return alert(`❌ ရုံးတည်နေရာမှ (${Math.round(distance)} မီတာ) ကွာဝေးနေပါသည်။`); const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); setAttendance([...attendance, { id: Date.now(), employeeId: currentEmployee.id, date: today, checkInTime: nowTime, status: 'Present', checkInGps: `${currentLoc.lat}, ${currentLoc.lon}` }]); alert(`✅ အောင်မြင်ပါသည်။ (${nowTime})`); };
  const handleCheckOut = () => { if (!currentEmployee || !currentLoc) return; const distance = getDistanceInMeters(currentLoc.lat, currentLoc.lon, defaultSetting.officeLatitude, defaultSetting.officeLongitude); if (distance > defaultSetting.allowedRadius) return alert('❌ ရုံးပတ်ဝန်းကျင်မှသာ ရုံးဆင်းစာရင်း သွင်းနိုင်ပါသည်။'); const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); setAttendance(attendance.map(a => a.employeeId === currentEmployee.id && a.date === today ? { ...a, checkOutTime: nowTime, checkOutGps: `${currentLoc.lat}, ${currentLoc.lon}` } : a)); alert(`✅ ရုံးဆင်းစာရင်း သွင်းပြီးပါပြီ။ (${nowTime})`); };

  const calculatePayroll = (emp: Employee) => {
    const empAtt = attendance.filter(a => a.employeeId === emp.id);
    const empAdvances = advances.filter(a => a.employeeId === emp.id && !a.deducted);
    const empLeaves = leaves.filter(l => l.employeeId === emp.id && l.status === 'Approved');

    const totalAdvance = empAdvances.reduce((sum, a) => sum + a.amount, 0);
    const extra = extraPays[emp.id] || { bonus: 0, commission: 0 };
    
    let totalLateDeduction = 0;
    let isPerfectAttendance = true; 
    let isPunctual = true;

    if (empLeaves.length > 0) isPerfectAttendance = false;

    const startMinutes = parseTimeToMinutes(defaultSetting.officeStartTime);
    
    empAtt.forEach(record => {
      if (!record.checkInTime) { isPerfectAttendance = false; isPunctual = false; return; }
      const checkInMins = parseTimeToMinutes(record.checkInTime);
      const lateMins = checkInMins - startMinutes;
      
      if (lateMins > 0) {
        isPunctual = false;
        const rule = defaultSetting.lateRules.find(r => lateMins >= r.startMin && lateMins <= r.endMin);
        if (rule) {
           if (rule.type === 'amount') totalLateDeduction += rule.deduction;
           else if (rule.type === 'half_day') { totalLateDeduction += (emp.basicSalary / 30 / 2); isPerfectAttendance = false; }
           else if (rule.type === 'full_day') { totalLateDeduction += (emp.basicSalary / 30); isPerfectAttendance = false; }
        }
      }
    });

    const earnedPunctuality = isPunctual ? defaultSetting.punctualityBonus : 0;
    const earnedPerfect = isPerfectAttendance ? defaultSetting.perfectAttendanceBonus : 0;
    const netPay = emp.basicSalary + earnedPunctuality + earnedPerfect + extra.bonus + extra.commission - totalAdvance - totalLateDeduction;

    return { totalAdvance, totalLateDeduction, earnedPunctuality, earnedPerfect, extra, netPay };
  };

  const confirmPayment = () => {
    if (!payslipData) return;
    const { emp, data } = payslipData;
    setAdvances(advances.map(a => a.employeeId === emp.id ? { ...a, deducted: true } : a));
    setExpenses(prev => [{ id: Date.now(), date: today, category: 'လစာနှင့် လုပ်အားခ', description: `Payroll: ${emp.name} ၏ လစာငွေထုတ်ပေးခြင်း`, amount: data.netPay, type: 'expense' }, ...prev]);
    setPayslipData(null);
    alert(`✅ ${emp.name} အတွက် လစာငွေ ထုတ်ပေးပြီး Finance Expense သို့ အော်တိုသွင်းပေးလိုက်ပါပြီ။`);
  };

  const handleThermalPrint = () => {
    const printWindow = window.open('', '', 'width=300,height=600');
    if (!printWindow || !payslipData) return;
    printWindow.document.write(`
      <html>
        <head>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 0; padding: 10px; width: 280px; }
            h2 { font-size: 16px; text-align: center; margin: 0 0 5px 0; }
            p { margin: 2px 0; }
            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
            .flex { display: flex; justify-content: space-between; }
            .bold { font-weight: bold; }
            .center { text-align: center; }
            .net { font-size: 16px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 5px 0; margin-top: 10px; }
          </style>
        </head>
        <body>
          <h2>SSY ERP</h2>
          <p class="center">OFFICIAL PAYSLIP</p>
          <div class="divider"></div>
          <p>Date: ${today}</p>
          <p>Name: <span class="bold">${payslipData.emp.name}</span></p>
          <p>Role: ${payslipData.emp.position}</p>
          <div class="divider"></div>
          
          <p>Basic Salary:</p>
          <p class="bold text-right" style="text-align:right;">${payslipData.emp.basicSalary.toLocaleString()} Ks</p>
          
          ${payslipData.data.earnedPerfect > 0 ? `<p>Perfect Attendance:</p><p class="bold" style="text-align:right;">+ ${payslipData.data.earnedPerfect.toLocaleString()} Ks</p>` : ''}
          ${payslipData.data.earnedPunctuality > 0 ? `<p>Punctuality Bonus:</p><p class="bold" style="text-align:right;">+ ${payslipData.data.earnedPunctuality.toLocaleString()} Ks</p>` : ''}
          ${payslipData.data.extra.bonus > 0 ? `<p>Extra Bonus:</p><p class="bold" style="text-align:right;">+ ${payslipData.data.extra.bonus.toLocaleString()} Ks</p>` : ''}
          ${payslipData.data.extra.commission > 0 ? `<p>Commission:</p><p class="bold" style="text-align:right;">+ ${payslipData.data.extra.commission.toLocaleString()} Ks</p>` : ''}
          
          ${payslipData.data.totalLateDeduction > 0 ? `<p>Late Deductions:</p><p class="bold" style="text-align:right;">- ${payslipData.data.totalLateDeduction.toLocaleString()} Ks</p>` : ''}
          ${payslipData.data.totalAdvance > 0 ? `<p>Advances Deducted:</p><p class="bold" style="text-align:right;">- ${payslipData.data.totalAdvance.toLocaleString()} Ks</p>` : ''}
          
          <div class="flex net">
            <span>NET PAY:</span>
            <span>${payslipData.data.netPay.toLocaleString()} Ks</span>
          </div>
          
          <div class="divider"></div>
          <p class="center" style="font-size:10px;">Generated by SSY System</p>
          <p class="center" style="font-size:10px;">Thank You!</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const todayAtt = currentEmployee ? attendance.find(a => a.employeeId === currentEmployee.id && a.date === today) : null;

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto space-y-6 print:p-0">
      
      {actionLeave && (
         <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
               <h3 className="font-black text-lg text-indigo-900 mb-4">ခွင့်ပြုချက် စီမံရန်</h3>
               <div className="bg-gray-50 p-4 rounded-xl mb-4 text-sm space-y-2">
                 <p><span className="font-bold text-gray-500">ဝန်ထမ်း:</span> {employees.find(e => e.id === actionLeave.employeeId)?.name}</p>
                 <p><span className="font-bold text-gray-500">ရက်စွဲ:</span> {actionLeave.startDate} မှ {actionLeave.endDate}</p>
                 <p><span className="font-bold text-gray-500">အမျိုးအစား:</span> {actionLeave.leaveType}</p>
                 <p><span className="font-bold text-gray-500">အကြောင်းရင်း:</span> {actionLeave.reason}</p>
               </div>
               <div className="mb-6">
                 <label className="text-xs font-bold text-gray-500 block mb-1">MD / HR မှတ်ချက် (Optional)</label>
                 <textarea value={leaveRemark} onChange={e=>setLeaveRemark(e.target.value)} className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" rows={3} placeholder="ခွင့်ပြု/မပြု အကြောင်းရင်း..."></textarea>
               </div>
               <div className="flex gap-3">
                 <button onClick={() => setActionLeave(null)} className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-xl">Cancel</button>
                 <button onClick={() => handleLeaveAction('Rejected')} className="flex-1 bg-rose-100 text-rose-700 hover:bg-rose-200 font-bold py-3 rounded-xl">❌ ပယ်ချမည်</button>
                 <button onClick={() => handleLeaveAction('Approved')} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 font-bold py-3 rounded-xl shadow-md">✅ ခွင့်ပြုမည်</button>
               </div>
            </div>
         </div>
      )}

      {payslipData && (
        <div className="fixed inset-0 bg-gray-900/80 z-[200] flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:z-auto backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:rounded-none">
            <div className="p-8 print:p-0">
               <div className="text-center border-b-2 border-indigo-100 pb-6 mb-6">
                 <h2 className="text-3xl font-black text-indigo-900 tracking-wider">SSY <span className="text-emerald-500">ERP</span></h2>
                 <p className="text-gray-500 font-bold tracking-widest text-xs mt-1 uppercase">Official Payslip (လစာဖြတ်ပိုင်း)</p>
               </div>
               
               <div className="flex justify-between items-center mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div>
                    <h3 className="font-black text-xl text-gray-800">{payslipData.emp.name}</h3>
                    <p className="text-xs font-bold text-indigo-600 uppercase mt-1">{payslipData.emp.position}</p>
                  </div>
                  <div className="text-right"><p className="text-xs font-bold text-gray-400">ထုတ်ပေးသည့်ရက်စွဲ</p><p className="font-bold text-gray-700">{today}</p></div>
               </div>

               <div className="space-y-3">
                 <div className="flex justify-between text-sm font-bold border-b border-gray-100 pb-2">
                   <span className="text-gray-600">အခြေခံလစာ (Basic Salary)</span><span className="text-gray-900">{payslipData.emp.basicSalary.toLocaleString()} Ks</span>
                 </div>
                 {payslipData.data.earnedPerfect > 0 && (
                   <div className="flex justify-between text-sm font-bold text-emerald-600 border-b border-gray-50 pb-2"><span>ရက်မှန်ကြေး (Perfect Attendance)</span><span>+ {payslipData.data.earnedPerfect.toLocaleString()} Ks</span></div>
                 )}
                 {payslipData.data.earnedPunctuality > 0 && (
                   <div className="flex justify-between text-sm font-bold text-emerald-600 border-b border-gray-50 pb-2"><span>အချိန်မှန်ကြေး (Punctuality)</span><span>+ {payslipData.data.earnedPunctuality.toLocaleString()} Ks</span></div>
                 )}
                 {payslipData.data.extra.bonus > 0 && (
                   <div className="flex justify-between text-sm font-bold text-emerald-600 border-b border-gray-50 pb-2"><span>အပိုဆုကြေး (Bonus)</span><span>+ {payslipData.data.extra.bonus.toLocaleString()} Ks</span></div>
                 )}
                 {payslipData.data.extra.commission > 0 && (
                   <div className="flex justify-between text-sm font-bold text-emerald-600 border-b border-gray-50 pb-2"><span>ကော်မရှင် (Commission)</span><span>+ {payslipData.data.extra.commission.toLocaleString()} Ks</span></div>
                 )}
                 {payslipData.data.totalLateDeduction > 0 && (
                   <div className="flex justify-between text-sm font-bold text-rose-500 border-b border-gray-50 pb-2"><span>နောက်ကျဒဏ်ကြေး (Late Fine)</span><span>- {payslipData.data.totalLateDeduction.toLocaleString()} Ks</span></div>
                 )}
                 {payslipData.data.totalAdvance > 0 && (
                   <div className="flex justify-between text-sm font-bold text-rose-500 border-b border-gray-50 pb-2"><span>ကြိုတင်ငွေဖြတ်တောက်ခြင်း (Advances)</span><span>- {payslipData.data.totalAdvance.toLocaleString()} Ks</span></div>
                 )}
               </div>

               <div className="mt-8 bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex justify-between items-center">
                  <span className="font-black text-indigo-900">အသားတင်ရငွေ (Net Pay)</span>
                  <span className="text-3xl font-black text-indigo-700">{payslipData.data.netPay.toLocaleString()} Ks</span>
               </div>
               
               <div className="mt-8 text-center text-[10px] font-bold text-gray-300 print:block">
                 *** ဤဖြတ်ပိုင်းသည် SSY ERP မှ အလိုအလျောက် ထုတ်ပေးထားခြင်းဖြစ်ပါသည် ***
               </div>
            </div>

            <div className="p-4 bg-gray-50 border-t flex flex-wrap justify-end gap-2 print:hidden">
              <button onClick={() => setPayslipData(null)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-200 rounded-lg">ပိတ်မည်</button>
              <button onClick={() => window.print()} className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700">A4 PDF ထုတ်မည်</button>
              <button onClick={handleThermalPrint} className="px-4 py-2 text-sm font-bold bg-slate-800 text-white rounded-lg shadow-sm hover:bg-slate-900">🖨️ Thermal (58/80mm) ထုတ်မည်</button>
              <button onClick={confirmPayment} className="px-4 py-2 text-sm font-black bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700">✅ Finance သွင်းမည်</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 border-b-2 border-indigo-200 pb-4 print:hidden">
        <span className="text-4xl">👥</span><h2 className="text-2xl font-extrabold text-indigo-900">ဝန်ထမ်းရေးရာ နှင့် ရုံးတက်/ဆင်း စနစ် (HR System)</h2>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 print:hidden">
        <button onClick={() => setActiveSubTab('attendance')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'attendance' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>📍 GPS Attendance</button>
        {isAdminOrHR && (
          <>
            <button onClick={() => setActiveSubTab('history')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'history' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>📅 မှတ်တမ်းများ</button>
            <button onClick={() => setActiveSubTab('leaves')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'leaves' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>📝 ခွင့်တိုင်ကြားမှု</button>
            <button onClick={() => setActiveSubTab('employees')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'employees' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>👩‍💼 ဝန်ထမ်းစာရင်း</button>
            <button onClick={() => setActiveSubTab('advances')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'advances' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>💸 ကြိုတင်ငွေ</button>
            <button onClick={() => setActiveSubTab('payroll')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'payroll' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>💰 လစာပေးချေမှု</button>
            {isMD && <button onClick={() => setActiveSubTab('settings')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'settings' ? 'bg-gray-800 text-white shadow' : 'bg-white text-gray-600 border'}`}>⚙️ မူဝါဒ & Settings</button>}
          </>
        )}
      </div>

      {activeSubTab === 'attendance' && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center justify-center py-12">
           <h3 className="text-2xl font-black text-gray-800 mb-2">မင်္ဂလာပါ, {userName}</h3>
           <p className="text-gray-500 font-bold mb-8">{today}</p>
           {locError && <div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold mb-6 w-full max-w-md text-center border border-red-200">⚠️ {locError}</div>}
           
           {!todayAtt?.checkInTime ? (
              <button onClick={handleCheckIn} className="w-48 h-48 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-black text-2xl shadow-2xl hover:scale-105 active:scale-95 transition-transform flex flex-col items-center justify-center gap-2 ring-8 ring-emerald-50"><span>📍</span>ရုံးတက်မည်</button>
           ) : !todayAtt.checkOutTime ? (
              <div className="text-center">
                 <div className="text-emerald-600 font-bold mb-8 bg-emerald-50 py-2 px-6 rounded-full inline-block">✅ ရုံးတက်ချိန်: {todayAtt.checkInTime}</div>
                 <button onClick={handleCheckOut} className="w-48 h-48 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-white font-black text-2xl shadow-2xl hover:scale-105 active:scale-95 transition-transform flex flex-col items-center justify-center gap-2 ring-8 ring-rose-50"><span>🏃</span>ရုံးဆင်းမည်</button>
              </div>
           ) : (
              <div className="text-center p-8 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                 <h4 className="text-xl font-black text-gray-700 mb-4">ယနေ့အတွက် တာဝန်ပြီးဆုံးပါပြီ</h4>
                 <div className="space-y-2 text-sm font-bold text-gray-500"><p>ရုံးတက်ချိန်: <span className="text-emerald-600">{todayAtt.checkInTime}</span></p><p>ရုံးဆင်းချိန်: <span className="text-rose-600">{todayAtt.checkOutTime}</span></p></div>
              </div>
           )}
           {currentLoc && (<div className="mt-8 text-[10px] text-gray-400 font-mono bg-gray-50 p-2 rounded">Distance from Office: {Math.round(getDistanceInMeters(currentLoc.lat, currentLoc.lon, defaultSetting.officeLatitude, defaultSetting.officeLongitude))} meters</div>)}
        </div>
      )}

      {activeSubTab === 'history' && isAdminOrHR && (
         <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-700">နေ့စဉ် တက်ရောက်မှု မှတ်တမ်း</h3></div>
            <div className="overflow-x-auto">
               <table className="w-full text-left text-sm whitespace-nowrap">
                 <thead className="bg-gray-100 text-gray-600 font-bold border-b">
                   <tr><th className="p-4">ရက်စွဲ</th><th className="p-4">ဝန်ထမ်းအမည်</th><th className="p-4">ရုံးတက်ချိန်</th><th className="p-4">ရုံးဆင်းချိန်</th><th className="p-4">Status</th></tr>
                 </thead>
                 <tbody>
                    {[...attendance].reverse().map(att => {
                       const emp = employees.find(e => e.id === att.employeeId);
                       return (
                         <tr key={att.id} className="border-b hover:bg-gray-50">
                           <td className="p-4 font-bold text-gray-700">{att.date}</td>
                           <td className="p-4 font-black text-indigo-700">{emp?.name || 'Unknown'}</td>
                           <td className="p-4 text-emerald-600 font-bold">{att.checkInTime || '-'}</td>
                           <td className="p-4 text-rose-600 font-bold">{att.checkOutTime || '-'}</td>
                           <td className="p-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">{att.status}</span></td>
                         </tr>
                       );
                    })}
                 </tbody>
               </table>
            </div>
         </div>
      )}

      {activeSubTab === 'leaves' && isAdminOrHR && (
         <div className="space-y-6">
            <form onSubmit={handleAddLeave} className="bg-white p-6 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
               <div className="col-span-1 md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">ဝန်ထမ်းရွေးချယ်ရန်</label>
                  <select required value={lvEmpId} onChange={e=>setLvEmpId(e.target.value)} className="w-full border p-3 text-sm rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                     <option value="">-- ရွေးချယ်ပါ --</option>
                     {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
               </div>
               <div><label className="text-xs font-bold text-gray-500 mb-1 block">စတင်မည့်ရက်</label><input type="date" required value={lvStart} onChange={e=>setLvStart(e.target.value)} className="w-full border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
               <div><label className="text-xs font-bold text-gray-500 mb-1 block">ပြီးဆုံးမည့်ရက်</label><input type="date" required value={lvEnd} onChange={e=>setLvEnd(e.target.value)} className="w-full border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
               <div className="col-span-1 md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">ခွင့်အမျိုးအစား</label>
                  <select value={lvType} onChange={e=>setLvType(e.target.value)} className="w-full border p-3 text-sm rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                     <option value="Sick Leave (နေမကောင်းခွင့်)">Sick Leave (နေမကောင်းခွင့်)</option>
                     <option value="Casual Leave (ကိစ္စရှိ၍ခွင့်)">Casual Leave (ကိစ္စရှိ၍ခွင့်)</option>
                  </select>
               </div>
               <div className="col-span-1 md:col-span-4"><label className="text-xs font-bold text-gray-500 mb-1 block">အကြောင်းရင်း</label><input required value={lvReason} onChange={e=>setLvReason(e.target.value)} className="w-full border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
               <div className="col-span-1 md:col-span-2"><button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 text-sm rounded-xl hover:bg-indigo-700 shadow-sm">➕ ခွင့်တင်မည်</button></div>
            </form>

            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                     <tr><th className="p-4">ဝန်ထမ်းအမည်</th><th className="p-4">ခွင့်ရက်စွဲ (From - To)</th><th className="p-4">ခွင့်အမျိုးအစား & အကြောင်းရင်း</th><th className="p-4">Status</th><th className="p-4 text-right">Action</th></tr>
                   </thead>
                   <tbody>
                      {leaves.map(l => {
                         const emp = employees.find(e => e.id === l.employeeId);
                         return (
                           <tr key={l.id} className="border-b hover:bg-gray-50">
                             <td className="p-4 font-black text-indigo-700">{emp?.name || 'Unknown'}</td>
                             <td className="p-4 font-bold text-gray-600">{l.startDate} <span className="text-xs font-normal">မှ</span> {l.endDate}</td>
                             <td className="p-4 text-gray-500 whitespace-normal min-w-[200px]">{l.leaveType} <br/><span className="text-xs text-gray-400">{l.reason}</span></td>
                             <td className="p-4">
                                {l.status === 'Pending' && <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase border border-amber-200">⏳ စောင့်ဆိုင်းဆဲ</span>}
                                {l.status === 'Approved' && <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase">✅ ခွင့်ပြုပြီး</span>}
                                {l.status === 'Rejected' && <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase">❌ ပယ်ချသည်</span>}
                             </td>
                             <td className="p-4 text-right">
                                {l.status === 'Pending' && <button onClick={() => setActionLeave(l)} className="bg-blue-100 text-blue-700 px-3 py-1 rounded shadow-sm text-xs font-bold hover:bg-blue-200">စီမံမည်</button>}
                             </td>
                           </tr>
                         )
                      })}
                   </tbody>
                 </table>
               </div>
            </div>
         </div>
      )}

      {/* 🌟 👩‍💼 Employees Tab (Android Responsive အပြည့်အဝပြင်ဆင်ပြီး) 🌟 */}
      {activeSubTab === 'employees' && isAdminOrHR && (
         <div className="space-y-6">
            <form onSubmit={handleSaveEmployee} className={`bg-white p-6 rounded-2xl shadow-sm border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end ${editingEmpId ? 'border-yellow-400 bg-yellow-50' : ''}`}>
               <div><label className="text-xs font-bold text-gray-500 mb-1 block">အမည်</label><input required value={empName} onChange={e=>setEmpName(e.target.value)} className="w-full border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
               <div><label className="text-xs font-bold text-gray-500 mb-1 block">ရာထူး</label><input required value={empPos} onChange={e=>setEmpPos(e.target.value)} className="w-full border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
               <div><label className="text-xs font-bold text-gray-500 mb-1 block">ဌာန</label><input required value={empDept} onChange={e=>setEmpDept(e.target.value)} className="w-full border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
               <div><label className="text-xs font-bold text-gray-500 mb-1 block">အခြေခံလစာ (Ks)</label><input type="number" required value={empSalary} onChange={e=>setEmpSalary(e.target.value)} className="w-full border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
               <div className="col-span-1 sm:col-span-2 flex gap-2">
                 <button type="submit" className={`flex-1 text-white text-sm font-bold py-3 rounded-xl ${editingEmpId ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{editingEmpId ? '💾 ပြင်ဆင်မည်' : '➕ ဝန်ထမ်းထည့်မည်'}</button>
                 {editingEmpId && <button type="button" onClick={resetEmpForm} className="bg-gray-200 text-gray-700 text-sm font-bold py-3 px-4 rounded-xl hover:bg-gray-300">✕ Cancel</button>}
               </div>
            </form>
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead className="bg-gray-50 text-gray-600 font-bold border-b"><tr><th className="p-4">ID</th><th className="p-4">အမည်</th><th className="p-4">ရာထူး / ဌာန</th><th className="p-4 text-right">လစာ</th><th className="p-4 text-center">Status</th>{isMD && <th className="p-4 text-right">Action</th>}</tr></thead>
                   <tbody>
                      {employees.map(e => (
                         <tr key={e.id} className="border-b hover:bg-gray-50">
                            <td className="p-4 text-xs text-gray-400">{e.id}</td>
                            <td className="p-4 font-bold text-gray-800">{e.name}</td>
                            <td className="p-4 text-gray-600">{e.position} <span className="text-xs text-gray-400">({e.department})</span></td>
                            <td className="p-4 font-bold text-emerald-600 text-right">{e.basicSalary.toLocaleString()} Ks</td>
                            <td className="p-4 text-center"><span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">{e.status}</span></td>
                         {isMD && (
                            <td className="p-4 text-right space-x-2">
                               <button onClick={() => handleEditEmployee(e)} className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded shadow-sm text-xs font-bold hover:bg-yellow-200">ပြင်မည်</button>
                               <button onClick={() => handleDeleteEmployee(e.id)} className="bg-red-100 text-red-700 px-3 py-1 rounded shadow-sm text-xs font-bold hover:bg-red-200">ဖျက်မည်</button>
                            </td>
                         )}
                         </tr>
                      ))}
                   </tbody>
                 </table>
               </div>
            </div>
         </div>
      )}

      {activeSubTab === 'advances' && isAdminOrHR && (
         <div className="space-y-6">
            <form onSubmit={handleAddAdvance} className="bg-white p-6 rounded-2xl shadow-sm border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
               <div className="col-span-1 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">ဝန်ထမ်းရွေးချယ်ရန်</label>
                  <select required value={advEmpId} onChange={e=>setAdvEmpId(e.target.value)} className="w-full border p-3 text-sm rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                     <option value="">-- ရွေးချယ်ပါ --</option>
                     {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.position})</option>)}
                  </select>
               </div>
               <div><label className="text-xs font-bold text-gray-500 mb-1 block">ကြိုတင်ငွေပမာဏ (Ks)</label><input type="number" required value={advAmount} onChange={e=>setAdvAmount(e.target.value)} className="w-full border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
               <div className="col-span-1 sm:col-span-3"><label className="text-xs font-bold text-gray-500 mb-1 block">အကြောင်းရင်း</label><input required value={advReason} onChange={e=>setAdvReason(e.target.value)} className="w-full border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="ဥပမာ - ဆေးဖိုး..." /></div>
               <div className="col-span-1"><button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 text-sm rounded-xl hover:bg-indigo-700 shadow-sm">➕ ထည့်မည်</button></div>
            </form>
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead className="bg-gray-50 text-gray-600 font-bold border-b"><tr><th className="p-4">ရက်စွဲ</th><th className="p-4">ဝန်ထမ်းအမည်</th><th className="p-4">အကြောင်းရင်း</th><th className="p-4 text-right">ပမာဏ</th><th className="p-4 text-center">Status</th></tr></thead>
                   <tbody>
                      {advances.map(a => {
                         const emp = employees.find(e => e.id === a.employeeId);
                         return (
                           <tr key={a.id} className="border-b hover:bg-gray-50">
                             <td className="p-4 font-bold text-gray-500">{a.date}</td>
                             <td className="p-4 font-black text-indigo-700">{emp?.name || 'Unknown'}</td>
                             <td className="p-4 text-gray-600">{a.reason}</td>
                             <td className="p-4 font-bold text-rose-600 text-right">{a.amount.toLocaleString()} Ks</td>
                             <td className="p-4 text-center">{a.deducted ? <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-[10px] font-bold uppercase border">လစာမှနုတ်ပြီး</span> : <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase border border-yellow-200">နုတ်ရန်ကျန်</span>}</td>
                           </tr>
                         )
                      })}
                   </tbody>
                 </table>
               </div>
            </div>
         </div>
      )}

      {activeSubTab === 'payroll' && isAdminOrHR && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {employees.map(emp => {
               const pData = calculatePayroll(emp);
               return (
                  <div key={emp.id} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                     <h4 className="font-black text-xl text-indigo-900 ml-2">{emp.name}</h4>
                     <span className="text-xs font-bold text-gray-400 mb-4 ml-2 uppercase">{emp.position}</span>
                     
                     <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2 text-sm font-bold text-gray-600 flex-1">
                        <div className="flex justify-between"><span>အခြေခံလစာ:</span><span className="text-gray-900">{emp.basicSalary.toLocaleString()} Ks</span></div>
                        
                        <div className="border-t border-gray-200 my-2 pt-2 text-[10px] text-gray-400 uppercase">ထပ်ဆောင်းရငွေများ (Additions)</div>
                        <div className="flex justify-between items-center text-emerald-600"><span>ရက်မှန်ကြေး:</span><span>+ {pData.earnedPerfect.toLocaleString()} Ks</span></div>
                        <div className="flex justify-between items-center text-emerald-600"><span>အချိန်မှန်ကြေး:</span><span>+ {pData.earnedPunctuality.toLocaleString()} Ks</span></div>
                        
                        <div className="flex justify-between items-center mt-2">
                           <span>Bonus အပိုဆု:</span>
                           <input type="number" value={pData.extra.bonus || ''} onChange={(e) => setExtraPays({...extraPays, [emp.id]: {...pData.extra, bonus: Number(e.target.value)}})} placeholder="0" className="w-24 text-right border rounded p-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500" />
                        </div>
                        <div className="flex justify-between items-center mt-1">
                           <span>Commission:</span>
                           <input type="number" value={pData.extra.commission || ''} onChange={(e) => setExtraPays({...extraPays, [emp.id]: {...pData.extra, commission: Number(e.target.value)}})} placeholder="0" className="w-24 text-right border rounded p-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500" />
                        </div>

                        <div className="border-t border-gray-200 my-2 pt-2 text-[10px] text-gray-400 uppercase">ဖြတ်တောက်ငွေများ (Deductions)</div>
                        <div className="flex justify-between text-rose-500"><span>နောက်ကျဒဏ်ကြေး:</span><span>- {pData.totalLateDeduction.toLocaleString()} Ks</span></div>
                        <div className="flex justify-between text-rose-500"><span>ကြိုတင်ငွေနုတ်:</span><span>- {pData.totalAdvance.toLocaleString()} Ks</span></div>
                     </div>
                     
                     <div className="flex justify-between items-center mt-4 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <span className="font-black text-indigo-900 text-sm">အသားတင်ရငွေ</span>
                        <span className="text-xl font-black text-indigo-700">{pData.netPay.toLocaleString()} Ks</span>
                     </div>
                     <button onClick={() => setPayslipData({ emp, data: pData })} className="mt-4 w-full bg-gray-900 text-white font-bold py-3 text-sm rounded-xl hover:bg-black shadow-md">🖨️ လစာထုတ်မည် / PDF ကြည့်မည်</button>
                  </div>
               )
            })}
         </div>
      )}

      {activeSubTab === 'settings' && isMD && (
         <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-gray-200 max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-3 border-b-2 border-indigo-100 pb-4"><h3 className="font-black text-xl md:text-2xl text-indigo-900">⚙️ လုပ်ငန်းခွင် မူဝါဒနှင့် ဒဏ်ကြေးသတ်မှတ်ချက်များ</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border">
                  <h4 className="font-bold text-gray-700 border-b pb-2">⏰ ရုံးချိန် & တည်နေရာ (GPS)</h4>
                  <div className="grid grid-cols-2 gap-4">
                     <div><label className="text-xs font-bold text-gray-500 block mb-1">ရုံးတက်ချိန်</label><input type="time" value={setStartTime} onChange={e=>setSetStartTime(e.target.value)} className="w-full border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
                     <div><label className="text-xs font-bold text-gray-500 block mb-1">ရုံးဆင်းချိန်</label><input type="time" value={setEndTime} onChange={e=>setSetEndTime(e.target.value)} className="w-full border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  </div>
                  <div className="pt-2 border-t mt-2">
                     <div className="flex justify-between items-end gap-2 mb-3">
                        <div className="flex-1"><label className="text-xs font-bold text-gray-500 block mb-1">Latitude</label><input value={setLat} onChange={e=>setSetLat(e.target.value)} className="w-full border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
                        <div className="flex-1"><label className="text-xs font-bold text-gray-500 block mb-1">Longitude</label><input value={setLon} onChange={e=>setSetLon(e.target.value)} className="w-full border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
                     </div>
                     <button type="button" onClick={handleAutoGetGPS} className="w-full bg-blue-600 text-white font-bold py-3 text-sm rounded-xl shadow-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"><span>📍</span> လက်ရှိနေရာကို (Auto) ရယူမည်</button>
                  </div>
                  <div><label className="text-xs font-bold text-gray-500 block mb-1">GPS ခွင့်ပြုမည့်အကွာအဝေး (မီတာ)</label><input type="number" value={setRad} onChange={e=>setSetRad(e.target.value)} className="w-full border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
               </div>

               <div className="space-y-4 bg-emerald-50 p-5 rounded-2xl border border-emerald-100">
                  <h4 className="font-bold text-emerald-800 border-b border-emerald-200 pb-2">💰 အားပေးဆုငွေများ (Bonuses)</h4>
                  <div><label className="text-xs font-bold text-emerald-600 block mb-1">ရက်မှန်ကြေး (Perfect Attendance)</label><input type="number" value={setPerfect} onChange={e=>setSetPerfect(e.target.value)} className="w-full border border-emerald-200 p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                  <div><label className="text-xs font-bold text-emerald-600 block mb-1">အချိန်မှန်ကြေး (Punctuality Bonus)</label><input type="number" value={setPunctuality} onChange={e=>setSetPunctuality(e.target.value)} className="w-full border border-emerald-200 p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                  <p className="text-[10px] text-emerald-600 font-bold">မှတ်ချက်: လစာထုတ်ချိန်တွင် အလိုအလျောက် ပေါင်းထည့်ပေးမည်ဖြစ်သည်။</p>
               </div>
            </div>

            <div className="bg-rose-50 p-5 md:p-6 rounded-2xl border border-rose-100">
               <h4 className="font-bold text-rose-800 border-b border-rose-200 pb-2 mb-4 flex justify-between items-center">
                  <span>📉 နောက်ကျဒဏ်ကြေး မူဝါဒများ</span>
                  <button onClick={() => setSetRules([...setRules, {id: Date.now(), startMin: 0, endMin: 0, deduction: 0, type: 'amount'}])} className="bg-rose-200 text-rose-800 text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-rose-300 shadow-sm">+ ထပ်ထည့်မည်</button>
               </h4>
               <div className="space-y-3">
                  {setRules.map((rule, index) => (
                     <div key={rule.id} className="flex flex-wrap items-center bg-white p-3 rounded-xl border border-rose-100 shadow-sm gap-2">
                        <span className="text-xs font-bold text-gray-500">မိနစ်:</span>
                        <input type="number" value={rule.startMin} onChange={(e) => { const newR = [...setRules]; newR[index].startMin = Number(e.target.value); setSetRules(newR); }} className="w-16 border rounded-lg p-2 text-sm text-center outline-none focus:border-rose-400" />
                        <span className="text-xs font-bold text-gray-500">မှ</span>
                        <input type="number" value={rule.endMin} onChange={(e) => { const newR = [...setRules]; newR[index].endMin = Number(e.target.value); setSetRules(newR); }} className="w-16 border rounded-lg p-2 text-sm text-center outline-none focus:border-rose-400" />
                        <span className="text-xs font-bold text-gray-500">အထိ =</span>
                        <select value={rule.type} onChange={(e) => { const newR = [...setRules]; newR[index].type = e.target.value as any; setSetRules(newR); }} className="flex-1 border rounded-lg p-2 text-sm bg-gray-50 font-bold text-rose-600 outline-none focus:border-rose-400">
                           <option value="amount">ငွေသားဖြတ်မည်</option>
                           <option value="half_day">နေ့ဝက် (Half-Day)</option>
                           <option value="full_day">ရက်ပျက် (Full-Day)</option>
                        </select>
                        {rule.type === 'amount' && (
                           <input type="number" value={rule.deduction} onChange={(e) => { const newR = [...setRules]; newR[index].deduction = Number(e.target.value); setSetRules(newR); }} placeholder="ဖြတ်မည့်ငွေ" className="w-24 border rounded-lg p-2 text-sm text-right outline-none focus:border-rose-400" />
                        )}
                        <button onClick={() => setSetRules(setRules.filter(r => r.id !== rule.id))} className="text-red-500 font-bold px-2 hover:bg-red-50 rounded-lg text-lg">✕</button>
                     </div>
                  ))}
               </div>
               <p className="text-[10px] text-rose-600 font-bold mt-4">မှတ်ချက်: လစာတွက်ချက်ရာတွင် ဤစည်းမျဉ်းများကို ကြည့်၍ အော်တို ဖြတ်တောက်မည်ဖြစ်သည်။</p>
            </div>
            <button onClick={handleSaveSettings} className="w-full bg-gradient-to-r from-indigo-600 to-indigo-800 text-white font-black py-4 text-sm rounded-xl shadow-lg hover:from-indigo-700 hover:to-indigo-900 transition-transform active:scale-95">💾 မူဝါဒများ အတည်ပြု သိမ်းဆည်းမည်</button>
         </div>
      )}
    </div>
  );
};