import React, { useState, useEffect } from 'react';
import type { Employee, Attendance, Advance, HRSetting, LateRule, ExpenseItem, AccountItem } from '../App';

interface HRProps {
  userRole: string; userName: string;
  employees: Employee[]; setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  attendance: Attendance[]; setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
  advances: Advance[]; setAdvances: React.Dispatch<React.SetStateAction<Advance[]>>;
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

export const HR: React.FC<HRProps> = ({ userRole, userName, employees, setEmployees, attendance, setAttendance, advances, setAdvances, hrSettings, setHrSettings, setExpenses }) => {
  const [activeSubTab, setActiveSubTab] = useState<'attendance' | 'employees' | 'advances' | 'payroll' | 'settings' | 'history'>('attendance');
  
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [empName, setEmpName] = useState(''); const [empPos, setEmpPos] = useState('');
  const [empDept, setEmpDept] = useState(''); const [empSalary, setEmpSalary] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  
  // 🌟 ကြိုတင်ငွေအတွက် State များ 🌟
  const [advEmpId, setAdvEmpId] = useState('');
  const [advAmount, setAdvAmount] = useState('');
  const [advReason, setAdvReason] = useState('');

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

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => { setCurrentLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }); setLocError(''); },
        (err) => { setLocError('GPS ဖွင့်ရန် သို့မဟုတ် Location ခွင့်ပြုချက် (Allow) ပေးရန် လိုအပ်ပါသည်။'); },
        { enableHighAccuracy: true }
      );
    } else { setLocError('သင်၏ ဖုန်းသည် GPS စနစ်ကို အထောက်အပံ့မပေးပါ။'); }
  }, []);

  const resetEmpForm = () => { setEditingEmpId(null); setEmpName(''); setEmpPos(''); setEmpDept(''); setEmpSalary(''); setEmpPhone(''); };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmpId) {
       setEmployees(employees.map(emp => emp.id === editingEmpId ? { ...emp, name: empName, position: empPos, department: empDept, basicSalary: Number(empSalary), phone: empPhone } : emp));
       alert('✅ ပြင်ဆင်မှု အောင်မြင်ပါသည်။');
    } else {
       const newEmp: Employee = { id: `EMP-${Date.now()}`, name: empName, position: empPos, department: empDept, basicSalary: Number(empSalary), joinedDate: today, phone: empPhone, status: 'Active' };
       setEmployees([...employees, newEmp]);
       alert('✅ ဝန်ထမ်းအသစ် စာရင်းသွင်းပြီးပါပြီ။');
    }
    resetEmpForm();
  };

  const handleEditEmployee = (emp: Employee) => { setEditingEmpId(emp.id); setEmpName(emp.name); setEmpPos(emp.position); setEmpDept(emp.department); setEmpSalary(emp.basicSalary.toString()); setEmpPhone(emp.phone); };
  const handleDeleteEmployee = (id: string) => { if (window.confirm("⚠️ ဤဝန်ထမ်းစာရင်းကို အပြီးတိုင် ဖျက်ပစ်မည်မှာ သေချာပါသလား?")) { setEmployees(employees.filter(e => e.id !== id)); } };

  // 🌟 ကြိုတင်ငွေ ထည့်သွင်းခြင်း Function 🌟
  const handleAddAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advEmpId || !advAmount) return alert('အချက်အလက် ပြည့်စုံစွာ ထည့်ပါ။');
    const newAdvance: Advance = { id: Date.now(), employeeId: advEmpId, date: today, amount: Number(advAmount), reason: advReason, status: 'Approved', deducted: false };
    setAdvances([newAdvance, ...advances]);
    setAdvEmpId(''); setAdvAmount(''); setAdvReason('');
    alert('✅ ကြိုတင်ငွေ မှတ်တမ်းတင်ပြီးပါပြီ။ လစာထုတ်ချိန်တွင် အလိုအလျောက် ဖြတ်တောက်ပါမည်။');
  };

  const handleAutoGetGPS = () => {
    if (currentLoc) {
      setSetLat(currentLoc.lat.toString()); setSetLon(currentLoc.lon.toString());
      alert('✅ လက်ရှိတည်နေရာကို အောင်မြင်စွာ ရယူပြီးပါပြီ။\n(မူဝါဒများ အတည်ပြု သိမ်းဆည်းမည် ကို ဆက်နှိပ်ပါ။)');
    } else {
      alert('⚠️ GPS တည်နေရာ ရှာဖွေနေဆဲဖြစ်ပါသည် သို့မဟုတ် ဖုန်း/ကွန်ပျူတာ Location ပိတ်ထားပါသည်။');
    }
  };

  const handleSaveSettings = () => {
    setHrSettings([{ id: 'default', officeLatitude: Number(setLat), officeLongitude: Number(setLon), allowedRadius: Number(setRad), officeStartTime: setStartTime, officeEndTime: setEndTime, punctualityBonus: Number(setPunctuality), perfectAttendanceBonus: Number(setPerfect), lateRules: setRules }]);
    alert('✅ HR နှင့် GPS မူဝါဒများ သိမ်းဆည်းခြင်း အောင်မြင်ပါသည်။');
  };

  const handleCheckIn = () => {
    if (!currentEmployee) return alert('သင်၏ အကောင့်အမည်ဖြင့် ဝန်ထမ်းစာရင်းတွင် မတွေ့ရှိပါ။ (HR ကို ဆက်သွယ်ပါ)');
    if (!currentLoc) return alert('GPS Location ရှာဖွေနေဆဲဖြစ်ပါသည်။ (ဖုန်း Location ဖွင့်ထားရန် သေချာစစ်ဆေးပါ)');
    const distance = getDistanceInMeters(currentLoc.lat, currentLoc.lon, defaultSetting.officeLatitude, defaultSetting.officeLongitude);
    if (distance > defaultSetting.allowedRadius) return alert(`❌ သင်သည် ရုံးတည်နေရာမှ (${Math.round(distance)} မီတာ) ကွာဝေးနေသဖြင့် ရုံးတက်စာရင်း သွင်း၍မရပါ။`);
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setAttendance([...attendance, { id: Date.now(), employeeId: currentEmployee.id, date: today, checkInTime: nowTime, status: 'Present', checkInGps: `${currentLoc.lat}, ${currentLoc.lon}` }]);
    alert(`✅ အောင်မြင်ပါသည်။ (ရုံးတက်ချိန်: ${nowTime})`);
  };

  const handleCheckOut = () => {
    if (!currentEmployee || !currentLoc) return;
    const distance = getDistanceInMeters(currentLoc.lat, currentLoc.lon, defaultSetting.officeLatitude, defaultSetting.officeLongitude);
    if (distance > defaultSetting.allowedRadius) return alert('❌ ရုံးပတ်ဝန်းကျင်မှသာ ရုံးဆင်းစာရင်း သွင်းနိုင်ပါသည်။');
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setAttendance(attendance.map(a => a.employeeId === currentEmployee.id && a.date === today ? { ...a, checkOutTime: nowTime, checkOutGps: `${currentLoc.lat}, ${currentLoc.lon}` } : a));
    alert(`✅ ရုံးဆင်းစာရင်း သွင်းပြီးပါပြီ။ (ရုံးဆင်းချိန်: ${nowTime})`);
  };

  const calculatePayroll = (emp: Employee) => {
    const empAtt = attendance.filter(a => a.employeeId === emp.id);
    const empAdvances = advances.filter(a => a.employeeId === emp.id && !a.deducted);
    const totalAdvance = empAdvances.reduce((sum, a) => sum + a.amount, 0);
    const extra = extraPays[emp.id] || { bonus: 0, commission: 0 };
    
    let totalLateDeduction = 0;
    let isPerfectAttendance = true; 
    let isPunctual = true;

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

  const handleProcessPayroll = (emp: Employee, payrollData: any) => {
    if (window.confirm(`⚠️ ${emp.name} အတွက် လစာငွေ ${payrollData.netPay.toLocaleString()} Ks အား ထုတ်ပေးပြီး Finance သို့ စာရင်းသွင်းမည်လား?`)) {
       setAdvances(advances.map(a => a.employeeId === emp.id ? { ...a, deducted: true } : a));
       setExpenses(prev => [{ id: Date.now(), date: today, category: 'လစာနှင့် လုပ်အားခ', description: `Payroll: ${emp.name} ၏ လစာငွေထုတ်ပေးခြင်း`, amount: payrollData.netPay, type: 'expense' }, ...prev]);
       alert('✅ လစာငွေ ထုတ်ပေးပြီး Finance Expense ထဲသို့ အော်တိုသွင်းပေးလိုက်ပါပြီ။');
    }
  };

  const todayAtt = currentEmployee ? attendance.find(a => a.employeeId === currentEmployee.id && a.date === today) : null;

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto space-y-6 print:p-0">
      <div className="flex items-center gap-3 border-b-2 border-indigo-200 pb-4 print:hidden">
        <span className="text-4xl">👥</span><h2 className="text-2xl font-extrabold text-indigo-900">ဝန်ထမ်းရေးရာ နှင့် ရုံးတက်/ဆင်း စနစ် (HR System)</h2>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 print:hidden">
        <button onClick={() => setActiveSubTab('attendance')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'attendance' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>📍 GPS Attendance</button>
        {isAdminOrHR && (
          <>
            <button onClick={() => setActiveSubTab('history')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'history' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>📅 မှတ်တမ်းများ</button>
            <button onClick={() => setActiveSubTab('employees')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'employees' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>👩‍💼 ဝန်ထမ်းစာရင်း</button>
            <button onClick={() => setActiveSubTab('advances')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'advances' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>💸 ကြိုတင်ငွေ</button>
            <button onClick={() => setActiveSubTab('payroll')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'payroll' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>💰 လစာပေးချေမှု</button>
            {isMD && <button onClick={() => setActiveSubTab('settings')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'settings' ? 'bg-gray-800 text-white shadow' : 'bg-white text-gray-600 border'}`}>⚙️ မူဝါဒ & Settings</button>}
          </>
        )}
      </div>

      {/* 📍 GPS Attendance Tab */}
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

      {/* 📅 မှတ်တမ်းများ (History Tab) */}
      {activeSubTab === 'history' && isAdminOrHR && (
         <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
               <h3 className="font-bold text-gray-700">ဝန်ထမ်းများ၏ နေ့စဉ် တက်ရောက်မှု မှတ်တမ်း</h3>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left text-sm whitespace-nowrap">
                 <thead className="bg-gray-100 text-gray-600 font-bold border-b">
                   <tr><th className="p-4">ရက်စွဲ (Date)</th><th className="p-4">ဝန်ထမ်းအမည်</th><th className="p-4">ရုံးတက်ချိန် (In)</th><th className="p-4">ရုံးဆင်းချိန် (Out)</th><th className="p-4">Status</th></tr>
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
                    {attendance.length === 0 && (<tr><td colSpan={5} className="p-8 text-center text-gray-400 font-bold">မှတ်တမ်းများ မရှိသေးပါ</td></tr>)}
                 </tbody>
               </table>
            </div>
         </div>
      )}

      {/* 👩‍💼 Employees Tab */}
      {activeSubTab === 'employees' && isAdminOrHR && (
         <div className="space-y-6">
            <form onSubmit={handleSaveEmployee} className={`bg-white p-6 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-6 gap-4 items-end ${editingEmpId ? 'border-yellow-400 bg-yellow-50' : ''}`}>
               <div><label className="text-xs font-bold text-gray-500">အမည်</label><input required value={empName} onChange={e=>setEmpName(e.target.value)} className="w-full border p-2.5 rounded-lg" /></div>
               <div><label className="text-xs font-bold text-gray-500">ရာထူး</label><input required value={empPos} onChange={e=>setEmpPos(e.target.value)} className="w-full border p-2.5 rounded-lg" /></div>
               <div><label className="text-xs font-bold text-gray-500">ဌာန</label><input required value={empDept} onChange={e=>setEmpDept(e.target.value)} className="w-full border p-2.5 rounded-lg" /></div>
               <div><label className="text-xs font-bold text-gray-500">အခြေခံလစာ</label><input type="number" required value={empSalary} onChange={e=>setEmpSalary(e.target.value)} className="w-full border p-2.5 rounded-lg" /></div>
               <div className="col-span-2 flex gap-2">
                 <button type="submit" className={`flex-1 text-white font-bold py-2.5 rounded-lg ${editingEmpId ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{editingEmpId ? '💾 ပြင်ဆင်မည်' : '➕ ဝန်ထမ်းထည့်မည်'}</button>
                 {editingEmpId && <button type="button" onClick={resetEmpForm} className="bg-gray-200 text-gray-700 font-bold py-2.5 px-4 rounded-lg hover:bg-gray-300">✕ Cancel</button>}
               </div>
            </form>
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
               <table className="w-full text-left text-sm">
                 <thead className="bg-gray-50 text-gray-600 font-bold border-b"><tr><th className="p-4">ID</th><th className="p-4">အမည်</th><th className="p-4">ရာထူး</th><th className="p-4">လစာ</th><th className="p-4">Status</th>{isMD && <th className="p-4 text-right">Action (MD Only)</th>}</tr></thead>
                 <tbody>
                    {employees.map(e => (
                       <tr key={e.id} className="border-b"><td className="p-4 text-xs text-gray-400">{e.id}</td><td className="p-4 font-bold">{e.name}</td><td className="p-4">{e.position} ({e.department})</td><td className="p-4 font-bold text-emerald-600">{e.basicSalary.toLocaleString()} Ks</td><td className="p-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">{e.status}</span></td>
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
      )}

      {/* 🌟 💸 Advances Tab (ကြိုတင်ငွေ) 🌟 */}
      {activeSubTab === 'advances' && isAdminOrHR && (
         <div className="space-y-6">
            <form onSubmit={handleAddAdvance} className="bg-white p-6 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
               <div>
                  <label className="text-xs font-bold text-gray-500">ဝန်ထမ်းရွေးချယ်ရန်</label>
                  <select required value={advEmpId} onChange={e=>setAdvEmpId(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white">
                     <option value="">-- ရွေးချယ်ပါ --</option>
                     {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.position})</option>)}
                  </select>
               </div>
               <div><label className="text-xs font-bold text-gray-500">ကြိုတင်ငွေပမာဏ (Ks)</label><input type="number" required value={advAmount} onChange={e=>setAdvAmount(e.target.value)} className="w-full border p-2.5 rounded-lg" /></div>
               <div><label className="text-xs font-bold text-gray-500">အကြောင်းရင်း</label><input required value={advReason} onChange={e=>setAdvReason(e.target.value)} className="w-full border p-2.5 rounded-lg" placeholder="ဥပမာ - ဆေးဖိုး..." /></div>
               <button type="submit" className="bg-indigo-600 text-white font-bold py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">➕ ထည့်မည်</button>
            </form>

            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
               <table className="w-full text-left text-sm">
                 <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                   <tr><th className="p-4">ရက်စွဲ</th><th className="p-4">ဝန်ထမ်းအမည်</th><th className="p-4">အကြောင်းရင်း</th><th className="p-4">ပမာဏ</th><th className="p-4">Status</th></tr>
                 </thead>
                 <tbody>
                    {advances.map(a => {
                       const emp = employees.find(e => e.id === a.employeeId);
                       return (
                         <tr key={a.id} className="border-b hover:bg-gray-50">
                           <td className="p-4 font-bold text-gray-500">{a.date}</td>
                           <td className="p-4 font-black text-indigo-700">{emp?.name || 'Unknown'}</td>
                           <td className="p-4 text-gray-600">{a.reason}</td>
                           <td className="p-4 font-bold text-rose-600">{a.amount.toLocaleString()} Ks</td>
                           <td className="p-4">
                             {a.deducted ? <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-[10px] font-bold uppercase border">လစာမှနုတ်ပြီး</span> : <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase border border-yellow-200">နုတ်ရန်ကျန်</span>}
                           </td>
                         </tr>
                       )
                    })}
                    {advances.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400 font-bold">ကြိုတင်ငွေ ထုတ်ယူထားခြင်း မရှိသေးပါ</td></tr>}
                 </tbody>
               </table>
            </div>
         </div>
      )}

      {/* 💰 Payroll Tab */}
      {activeSubTab === 'payroll' && isAdminOrHR && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                           <input type="number" value={pData.extra.bonus || ''} onChange={(e) => setExtraPays({...extraPays, [emp.id]: {...pData.extra, bonus: Number(e.target.value)}})} placeholder="0" className="w-24 text-right border rounded p-1 text-xs" />
                        </div>
                        <div className="flex justify-between items-center mt-1">
                           <span>Commission:</span>
                           <input type="number" value={pData.extra.commission || ''} onChange={(e) => setExtraPays({...extraPays, [emp.id]: {...pData.extra, commission: Number(e.target.value)}})} placeholder="0" className="w-24 text-right border rounded p-1 text-xs" />
                        </div>

                        <div className="border-t border-gray-200 my-2 pt-2 text-[10px] text-gray-400 uppercase">ဖြတ်တောက်ငွေများ (Deductions)</div>
                        <div className="flex justify-between text-rose-500"><span>နောက်ကျဒဏ်ကြေး:</span><span>- {pData.totalLateDeduction.toLocaleString()} Ks</span></div>
                        <div className="flex justify-between text-rose-500"><span>ကြိုတင်ငွေနုတ်:</span><span>- {pData.totalAdvance.toLocaleString()} Ks</span></div>
                     </div>
                     
                     <div className="flex justify-between items-center mt-4 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <span className="font-black text-indigo-900 text-sm">အသားတင်ရငွေ (Net Pay)</span>
                        <span className="text-2xl font-black text-indigo-600">{pData.netPay.toLocaleString()} Ks</span>
                     </div>
                     <button onClick={() => handleProcessPayroll(emp, pData)} className="mt-4 w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black shadow-md">💳 လစာထုတ်ပေးမည်</button>
                  </div>
               )
            })}
         </div>
      )}

      {/* ⚙️ Settings Tab (Dynamic Policies for MD Only) */}
      {activeSubTab === 'settings' && isMD && (
         <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-gray-200 max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-3 border-b-2 border-indigo-100 pb-4">
              <h3 className="font-black text-2xl text-indigo-900">⚙️ လုပ်ငန်းခွင် မူဝါဒနှင့် ဒဏ်ကြေးသတ်မှတ်ချက်များ</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border">
                  <h4 className="font-bold text-gray-700 border-b pb-2">⏰ ရုံးချိန် & တည်နေရာ (GPS)</h4>
                  <div className="grid grid-cols-2 gap-4">
                     <div><label className="text-xs font-bold text-gray-500">ရုံးတက်ချိန်</label><input type="time" value={setStartTime} onChange={e=>setSetStartTime(e.target.value)} className="w-full border p-2.5 rounded-lg" /></div>
                     <div><label className="text-xs font-bold text-gray-500">ရုံးဆင်းချိန်</label><input type="time" value={setEndTime} onChange={e=>setSetEndTime(e.target.value)} className="w-full border p-2.5 rounded-lg" /></div>
                  </div>
                  <div className="pt-2 border-t mt-2">
                     <div className="flex justify-between items-end gap-2 mb-2">
                        <div className="flex-1"><label className="text-xs font-bold text-gray-500">Latitude</label><input value={setLat} onChange={e=>setSetLat(e.target.value)} className="w-full border p-2.5 rounded-lg" /></div>
                        <div className="flex-1"><label className="text-xs font-bold text-gray-500">Longitude</label><input value={setLon} onChange={e=>setSetLon(e.target.value)} className="w-full border p-2.5 rounded-lg" /></div>
                     </div>
                     <button type="button" onClick={handleAutoGetGPS} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg shadow-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"><span>📍</span> လက်ရှိနေရာကို (Auto) ရယူမည်</button>
                  </div>
                  <div><label className="text-xs font-bold text-gray-500">GPS ခွင့်ပြုမည့်အကွာအဝေး (မီတာ)</label><input type="number" value={setRad} onChange={e=>setSetRad(e.target.value)} className="w-full border p-2.5 rounded-lg" /></div>
               </div>

               <div className="space-y-4 bg-emerald-50 p-5 rounded-2xl border border-emerald-100">
                  <h4 className="font-bold text-emerald-800 border-b border-emerald-200 pb-2">💰 အားပေးဆုငွေများ (Bonuses)</h4>
                  <div><label className="text-xs font-bold text-emerald-600">ရက်မှန်ကြေး (Perfect Attendance)</label><input type="number" value={setPerfect} onChange={e=>setSetPerfect(e.target.value)} className="w-full border-emerald-200 p-2.5 rounded-lg" /></div>
                  <div><label className="text-xs font-bold text-emerald-600">အချိန်မှန်ကြေး (Punctuality Bonus)</label><input type="number" value={setPunctuality} onChange={e=>setSetPunctuality(e.target.value)} className="w-full border-emerald-200 p-2.5 rounded-lg" /></div>
                  <p className="text-[10px] text-emerald-600 font-bold">မှတ်ချက်: လစာထုတ်ချိန်တွင် အလိုအလျောက် ပေါင်းထည့်ပေးမည်ဖြစ်သည်။</p>
               </div>
            </div>

            <div className="bg-rose-50 p-5 md:p-6 rounded-2xl border border-rose-100">
               <h4 className="font-bold text-rose-800 border-b border-rose-200 pb-2 mb-4 flex justify-between items-center">
                  <span>📉 နောက်ကျဒဏ်ကြေး မူဝါဒများ (Dynamic Rules)</span>
                  <button onClick={() => setSetRules([...setRules, {id: Date.now(), startMin: 0, endMin: 0, deduction: 0, type: 'amount'}])} className="bg-rose-200 text-rose-800 text-xs px-3 py-1 rounded font-bold hover:bg-rose-300">+ ထပ်ထည့်မည်</button>
               </h4>
               <div className="space-y-3">
                  {setRules.map((rule, index) => (
                     <div key={rule.id} className="flex flex-wrap md:flex-nowrap gap-3 items-center bg-white p-3 rounded-xl border border-rose-100 shadow-sm">
                        <span className="text-xs font-bold text-gray-500 w-16">မိနစ်:</span>
                        <input type="number" value={rule.startMin} onChange={(e) => { const newR = [...setRules]; newR[index].startMin = Number(e.target.value); setSetRules(newR); }} className="w-16 border rounded p-2 text-sm text-center" />
                        <span className="text-xs font-bold text-gray-500">မှ</span>
                        <input type="number" value={rule.endMin} onChange={(e) => { const newR = [...setRules]; newR[index].endMin = Number(e.target.value); setSetRules(newR); }} className="w-16 border rounded p-2 text-sm text-center" />
                        <span className="text-xs font-bold text-gray-500 w-16">အထိ =</span>
                        <select value={rule.type} onChange={(e) => { const newR = [...setRules]; newR[index].type = e.target.value as any; setSetRules(newR); }} className="w-32 border rounded p-2 text-sm bg-gray-50 font-bold text-rose-600 outline-none">
                           <option value="amount">ငွေသားဖြတ်မည်</option>
                           <option value="half_day">နေ့ဝက် (Half-Day)</option>
                           <option value="full_day">ရက်ပျက် (Full-Day)</option>
                        </select>
                        {rule.type === 'amount' && (
                           <input type="number" value={rule.deduction} onChange={(e) => { const newR = [...setRules]; newR[index].deduction = Number(e.target.value); setSetRules(newR); }} placeholder="ဖြတ်မည့်ငွေ" className="w-24 border rounded p-2 text-sm text-right" />
                        )}
                        <button onClick={() => setSetRules(setRules.filter(r => r.id !== rule.id))} className="ml-auto text-red-500 font-bold px-2 hover:bg-red-50 rounded">✕</button>
                     </div>
                  ))}
               </div>
               <p className="text-[10px] text-rose-600 font-bold mt-4">မှတ်ချက်: လစာတွက်ချက်ရာတွင် ဤစည်းမျဉ်းများကို ကြည့်၍ အော်တို ဖြတ်တောက်မည်ဖြစ်သည်။</p>
            </div>

            <button onClick={handleSaveSettings} className="w-full bg-gradient-to-r from-indigo-600 to-indigo-800 text-white font-black py-4 rounded-xl shadow-lg hover:from-indigo-700 hover:to-indigo-900 text-lg transition-transform active:scale-95">💾 မူဝါဒများ အတည်ပြု သိမ်းဆည်းမည်</button>
         </div>
      )}
    </div>
  );
};
