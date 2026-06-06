import React, { useState } from 'react';

// ကုန်ကြမ်းအတွက် လိုအပ်သော အချက်အလက်များ သတ်မှတ်ခြင်း
interface Material {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  price: number;
}

export const RawMaterials = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('ပိဿာ');
  const [price, setPrice] = useState('');

  // ကုန်ကြမ်းအသစ် ထည့်သွင်းခြင်း
  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !quantity || !price) return;

    const newMaterial: Material = {
      id: Date.now(),
      name: name,
      quantity: parseFloat(quantity),
      unit: unit,
      price: parseFloat(price),
    };

    setMaterials([...materials, newMaterial]);
    // စာရင်းသွင်းပြီးပါက အကွက်များကို ပြန်လွတ်ပေးခြင်း
    setName('');
    setQuantity('');
    setPrice('');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-blue-600">ကုန်ကြမ်းစာရင်း (Raw Materials)</h2>

      {/* Data သွင်းရန် Form */}
      <form onSubmit={handleAddMaterial} className="bg-gray-100 p-4 rounded-lg mb-6 flex gap-4 items-end">
        <div>
          <label className="block text-sm mb-1">ကုန်ကြမ်းအမည်</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="border p-2 rounded w-full" placeholder="ဥပမာ - သကြား" />
        </div>
        <div>
          <label className="block text-sm mb-1">အရေအတွက်</label>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="border p-2 rounded w-full" placeholder="၀.၀၀" />
        </div>
        <div>
          <label className="block text-sm mb-1">ယူနစ်</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className="border p-2 rounded w-full">
            <option value="ပိဿာ">ပိဿာ</option>
            <option value="ကီလို">ကီလို</option>
            <option value="ခု">ခု</option>
            <option value="ထုပ်">ထုပ်</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">စုစုပေါင်း ကျသင့်ငွေ (Ks)</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="border p-2 rounded w-full" placeholder="၀.၀၀" />
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          စာရင်းသွင်းမည်
        </button>
      </form>

      {/* Data ပြသမည့် ဇယား */}
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-blue-100 border-b-2 border-blue-200">
            <th className="p-3">စဉ်</th>
            <th className="p-3">ကုန်ကြမ်းအမည်</th>
            <th className="p-3">အရေအတွက်</th>
            <th className="p-3">ကုန်ကျငွေ (Ks)</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((item, index) => (
            <tr key={item.id} className="border-b hover:bg-gray-50">
              <td className="p-3">{index + 1}</td>
              <td className="p-3 font-semibold">{item.name}</td>
              <td className="p-3">{item.quantity} {item.unit}</td>
              <td className="p-3">{item.price} Ks</td>
            </tr>
          ))}
          {materials.length === 0 && (
            <tr>
              <td colSpan={4} className="p-4 text-center text-gray-500">ကုန်ကြမ်းစာရင်း မရှိသေးပါ။</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
