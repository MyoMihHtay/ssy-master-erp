import React, { useState, useEffect } from 'react';
import type { Employee, Attendance, Advance, HRSetting, ExpenseItem, AccountItem } from '../App';

interface HRProps {
  userRole: string; userName: string;
  employees: Employee[]; setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  attendance: Attendance[]; setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
  advances: Advance[]; setAdvances: React.Dispatch<React.SetStateAction<Advance[]>>;
  hrSettings: HRSetting[]; setHrSettings: React.Dispatch<React.SetStateAction<HRSetting[]>>;
  setExpenses: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
  accounts: AccountItem[];
}

// 🌐 GPS Haversine Formula (အကွာအဝေးကို မီတာဖြင့် တွက်ချက်ခြင်း)
const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth's radius in meters
  const p1 = lat1 * Math.PI/180; const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180; const dl = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const HR: React.FC<HRProps> = ({ userRole, userName, employees, setEmployees, attendance, setAttendance, advances, setAdvances, hrSettings, setHrSettings, setExpenses, accounts }) => {
  const [activeSubTab, setActiveSubTab] = useState<'attendance' | 'employees' | 'advances' | 'payroll' | 'settings'>('attendance');
  
  // States for new employee
  const [empName, setEmpName] = useState(''); const [empPos, setEmpPos] = useState('');
  const [empDept, setEmpDept] = useState(''); const [empSalary, setEmpSalary] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  
  // Settings
  const defaultSetting = hrSettings.find(s => s.id === 'default') || { id: 'default', officeLatitude: 21.9588, officeLongitude: 96.0891, allowedRadius: 50 };
  const [setLat, setSetLat] = useState(defaultSetting.officeLatitude.toString());
  const [setLon, setSetLon] = useState(defaultSetting.officeLongitude.toString());
  const [setRad, setSetRad] = useState(defaultSetting.allowedRadius.toString());

  // Location State
  const [currentLoc, setCurrentLoc] = useState<{lat: number, lon: number, accuracy: number} | null>(null);
  const [locError, setLocError] = useState('');

  const isAdminOrHR = userRole === 'md' || userRole === 'manager' || userRole === 'hr';
  
  // ၀န်ထမ်းများအတွက် သူတို့ရဲ့ ID ကို Account (UserName) ဖြင့် ချိတ်ဆက်ရှာဖွေခြင်း
  const currentEmployee = employees.find(e => e.name.toLowerCase() === userName.toLowerCase() || e.id === userName);
  const today = new Date().toLocaleDateString('en-GB');

  // Request Location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => { setCurrentLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }); setLocError(''); },
        (err) => { setLocError('GPS ဖွင့်ရန် သို့မဟုတ် Location ခွင့်ပြုချက် (Allow) ပေးရန် လိုအပ်ပါသည်။'); },
        { enableHighAccuracy: true }
      );
    } else { setLocError('သင်၏ ဖုန်းသည် GPS စနစ်ကို အထောက်အပံ့မပေးပါ။'); }
  }, []);

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const newEmp: Employee = { id: `EMP-${Date.now()}`, name: empName, position: empPos, department: empDept, basicSalary: Number(empSalary), joinedDate: today, phone: empPhone, status: 'Active' };
    setEmployees([...employees, newEmp]);
    setEmpName(''); setEmpPos(''); setEmpDept(''); setEmpSalary(''); setEmpPhone('');
    alert('✅ ဝန်ထမ်းအသစ် စာရင်းသွင်းပြီးပါပြီ။');
  };

  const handleSaveSettings = () => {
    setHrSettings([{ id: 'default', officeLatitude: Number(setLat), officeLongitude: Number(setLon), allowedRadius: Number(setRad) }]);
    alert('✅ ရုံး GPS တည်နေရာ ပြောင်းလဲသတ်မှတ်ခြင်း အောင်မြင်ပါသည်။');
  };

  const handleCheckIn = () => {
    if (!currentEmployee) return alert('သင်၏ အကောင့်အမည်ဖြင့် ဝန်ထမ်းစာရင်းတွင် မတွေ့ရှိပါ။ (HR ကို ဆက်သွယ်ပါ)');
    if (!currentLoc) return alert('GPS Location ရှာဖွေနေဆဲဖြစ်ပါသည်။ (ဖုန်း Location ဖွင့်ထားရန် သေချာစစ်ဆေးပါ)');
    
    const distance = getDistanceInMeters(currentLoc.lat, currentLoc.lon, defaultSetting.officeLatitude, defaultSetting.officeLongitude);
    if (distance > defaultSetting.allowedRadius) return alert(`❌ သင်သည် ရုံးတည်နေရာမှ (${Math.round(distance)} မီတာ) ကွာဝေးနေသဖြင့် ရုံးတက်စာရင်း သွင်း၍မရပါ။ \nသတ်မှတ်ထားသော အကွာအဝေး: ${defaultSetting.allowedRadius} မီတာ။`);

    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const existing = attendance.find(a => a.employeeId === currentEmployee.id && a.date === today);
    if (existing) return alert('ယနေ့အတွက် ရုံးတက်စာရင်း သွင်းပြီးဖြစ်ပါသည်။');

    const newAtt: Attendance = { id: Date.now(), employeeId: currentEmployee.id, date: today, checkInTime: nowTime, status: 'Present', checkInGps: `${currentLoc.lat}, ${currentLoc.lon}` };
    setAttendance([...attendance, newAtt]);
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

  const handleProcessPayroll = (empId: string) => {
    const emp = employees.find(e => e.id === empId); if (!emp) return;
    const empAdvances = advances.filter(a => a.employeeId === empId && !a.deducted);
    const totalAdvance = empAdvances.reduce((sum, a) => sum + a.amount, 0);
    const netPay = emp.basicSalary - totalAdvance;

    if (window.confirm(`⚠️ ${emp.name} အတွက် လစာငွေ ${netPay.toLocaleString()} Ks (အခြေခံ: ${emp.basicSalary} - ကြိုတင်ငွေ: ${totalAdvance}) ထုတ်ပေးပြီး Finance သို့ စာရင်းသွင်းမည်လား?`)) {
       setAdvances(advances.map(a => a.employeeId === empId ? { ...a, deducted: true } : a));
       setExpenses(prev => [{ id: Date.now(), date: today, category: 'လစာနှင့် လုပ်အားခ', description: `Payroll: ${emp.name} ၏ လစာငွေထုတ်ပေးခြင်း`, amount: netPay, type: 'expense' }, ...prev]);
       alert('✅ လစာငွေ ထုတ်ပေးပြီး Finance Expense ထဲသို့ အော်တိုသွင်းပေးလိုက်ပါပြီ။');
    }
  };

  const todayAtt = currentEmployee ? attendance.find(a => a.employeeId === currentEmployee.id && a.date === today) : null;

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b-2 border-indigo-200 pb-4">
        <span className="text-4xl">👥</span><h2 className="text-2xl font-extrabold text-indigo-900">ဝန်ထမ်းရေးရာ နှင့် ရုံးတက်/ဆင်း စနစ် (HR System)</h2>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setActiveSubTab('attendance')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'attendance' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>📍 GPS Attendance</button>
        {isAdminOrHR && (
          <>
            <button onClick={() => setActiveSubTab('employees')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'employees' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>👩‍💼 ဝန်ထမ်းစာရင်း</button>
            <button onClick={() => setActiveSubTab('advances')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'advances' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>💸 ကြိုတင်ငွေ</button>
            <button onClick={() => setActiveSubTab('payroll')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'payroll' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>💰 လစာပေးချေမှု</button>
            {userRole === 'md' && <button onClick={() => setActiveSubTab('settings')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeSubTab === 'settings' ? 'bg-gray-800 text-white shadow' : 'bg-white text-gray-600 border'}`}>⚙️ GPS Settings</button>}
          </>
        )}
      </div>

      {/* 📍 GPS Attendance Tab (For All Users) */}
      {activeSubTab === 'attendance' && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center justify-center py-12">
           <h3 className="text-2xl font-black text-gray-800 mb-2">မင်္ဂလာပါ, {userName}</h3>
           <p className="text-gray-500 font-bold mb-8">{today}</p>
           
           {locError && <div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold mb-6 w-full max-w-md text-center border border-red-200">⚠️ {locError}</div>}
           
           {!todayAtt?.checkInTime ? (
              <button onClick={handleCheckIn} className="w-48 h-48 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-black text-2xl shadow-2xl hover:scale-105 active:scale-95 transition-transform flex flex-col items-center justify-center gap-2 ring-8 ring-emerald-50">
                 <span>📍</span>ရုံးတက်မည်
              </button>
           ) : !todayAtt.checkOutTime ? (
              <div className="text-center">
                 <div className="text-emerald-600 font-bold mb-8 bg-emerald-50 py-2 px-6 rounded-full inline-block">✅ ရုံးတက်ချိန်: {todayAtt.checkInTime}</div>
                 <button onClick={handleCheckOut} className="w-48 h-48 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-white font-black text-2xl shadow-2xl hover:scale-105 active:scale-95 transition-transform flex flex-col items-center justify-center gap-2 ring-8 ring-rose-50">
                   <span>🏃</span>ရုံးဆင်းမည်
                 </button>
              </div>
           ) : (
              <div className="text-center p-8 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                 <h4 className="text-xl font-black text-gray-700 mb-4">ယနေ့အတွက် တာဝန်ပြီးဆုံးပါပြီ</h4>
                 <div className="space-y-2 text-sm font-bold text-gray-500">
                   <p>ရုံးတက်ချိန်: <span className="text-emerald-600">{todayAtt.checkInTime}</span></p>
                   <p>ရုံးဆင်းချိန်: <span className="text-rose-600">{todayAtt.checkOutTime}</span></p>
                 </div>
              </div>
           )}

           {currentLoc && (
              <div className="mt-8 text-[10px] text-gray-400 font-mono bg-gray-50 p-2 rounded">
                 Current GPS: {currentLoc.lat.toFixed(6)}, {currentLoc.lon.toFixed(6)} 
                 <br/>Distance from Office: {Math.round(getDistanceInMeters(currentLoc.lat, currentLoc.lon, defaultSetting.officeLatitude, defaultSetting.officeLongitude))} meters
              </div>
           )}
        </div>
      )}

      {/* 👩‍💼 Employees Tab */}
      {activeSubTab === 'employees' && isAdminOrHR && (
         <div className="space-y-6">
            <form onSubmit={handleAddEmployee} className="bg-white p-6 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
               <div><label className="text-xs font-bold text-gray-500">အမည်</label><input required value={empName} onChange={e=>setEmpName(e.target.value)} className="w-full border p-2.5 rounded-lg" /></div>
               <div><label className="text-xs font-bold text-gray-500">ရာထူး</label><input required value={empPos} onChange={e=>setEmpPos(e.target.value)} className="w-full border p-2.5 rounded-lg" /></div>
               <div><label className="text-xs font-bold text-gray-500">ဌာန</label><input required value={empDept} onChange={e=>setEmpDept(e.target.value)} className="w-full border p-2.5 rounded-lg" /></div>
               <div><label className="text-xs font-bold text-gray-500">အခြေခံလစာ</label><input type="number" required value={empSalary} onChange={e=>setEmpSalary(e.target.value)} className="w-full border p-2.5 rounded-lg" /></div>
               <button className="bg-indigo-600 text-white font-bold py-2.5 rounded-lg">➕ ဝန်ထမ်းထည့်မည်</button>
            </form>
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
               <table className="w-full text-left text-sm">
                 <thead className="bg-gray-50 text-gray-600 font-bold border-b"><tr><th className="p-4">ID</th><th className="p-4">အမည်</th><th className="p-4">ရာထူး</th><th className="p-4">လစာ</th><th className="p-4">Status</th></tr></thead>
                 <tbody>
                    {employees.map(e => (
                       <tr key={e.id} className="border-b"><td className="p-4 text-xs text-gray-400">{e.id}</td><td className="p-4 font-bold">{e.name}</td><td className="p-4">{e.position} ({e.department})</td><td className="p-4 font-bold text-emerald-600">{e.basicSalary.toLocaleString()} Ks</td><td className="p-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">{e.status}</span></td></tr>
                    ))}
                 </tbody>
               </table>
            </div>
         </div>
      )}

      {/* 💰 Payroll Tab */}
      {activeSubTab === 'payroll' && isAdminOrHR && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map(emp => {
               const empAdvances = advances.filter(a => a.employeeId === emp.id && !a.deducted);
               const totalAdv = empAdvances.reduce((sum, a) => sum + a.amount, 0);
               return (
                  <div key={emp.id} className="bg-white p-6 rounded-2xl shadow-sm border flex flex-col">
                     <h4 className="font-black text-lg text-gray-800">{emp.name}</h4>
                     <span className="text-xs text-gray-500 mb-4">{emp.position}</span>
                     <div className="space-y-2 text-sm border-y py-4 mb-4 flex-1">
                        <div className="flex justify-between font-bold text-gray-600"><span>အခြေခံလစာ:</span><span>{emp.basicSalary.toLocaleString()} Ks</span></div>
                        <div className="flex justify-between font-bold text-rose-500"><span>ကြိုတင်ငွေနုတ်:</span><span>- {totalAdv.toLocaleString()} Ks</span></div>
                     </div>
                     <div className="flex justify-between items-center mb-4">
                        <span className="font-bold text-gray-500">ပေးရန်ကျန်:</span>
                        <span className="text-xl font-black text-emerald-600">{(emp.basicSalary - totalAdv).toLocaleString()} Ks</span>
                     </div>
                     <button onClick={() => handleProcessPayroll(emp.id)} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black">💳 လစာထုတ်ပေးမည်</button>
                  </div>
               )
            })}
         </div>
      )}

      {/* ⚙️ Settings Tab (MD Only) */}
      {activeSubTab === 'settings' && userRole === 'md' && (
         <div className="bg-white p-6 rounded-2xl shadow-sm border max-w-lg">
            <h3 className="font-black text-lg mb-6 border-b pb-2">📍 ရုံး GPS တည်နေရာ သတ်မှတ်ခြင်း</h3>
            <div className="space-y-4">
               <div><label className="text-xs font-bold text-gray-500">Latitude</label><input value={setLat} onChange={e=>setSetLat(e.target.value)} className="w-full border p-2.5 rounded-lg bg-gray-50" /></div>
               <div><label className="text-xs font-bold text-gray-500">Longitude</label><input value={setLon} onChange={e=>setSetLon(e.target.value)} className="w-full border p-2.5 rounded-lg bg-gray-50" /></div>
               <div><label className="text-xs font-bold text-gray-500">ခွင့်ပြုမည့် အကွာအဝေး (Meters)</label><input type="number" value={setRad} onChange={e=>setSetRad(e.target.value)} className="w-full border p-2.5 rounded-lg bg-gray-50" /></div>
               
               <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-lg border border-blue-200">
                  💡 သင်၏ လက်ရှိ GPS: {currentLoc ? `${currentLoc.lat}, ${currentLoc.lon}` : 'Loading...'} (ဤဂဏန်းများကို အထက်တွင် ကူးထည့်၍ အလွယ်တကူ သတ်မှတ်နိုင်ပါသည်။)
               </div>
               <button onClick={handleSaveSettings} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl">💾 သိမ်းဆည်းမည်</button>
            </div>
         </div>
      )}
    </div>
  );
};
