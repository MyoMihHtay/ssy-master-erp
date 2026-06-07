import React, { useState, useMemo } from 'react';
import type { InventoryItem, BOMResult, Recipe, RecipeIngredient } from '../App';

interface ProductionProps {
  userRole: string;
  inventoryItems: InventoryItem[];
  recipes: Recipe[];
  setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>;
  onProductionConfirm: (category: string, taste: string, gram: number, qty: number, bomResults: BOMResult[]) => void;
}

export const Production: React.FC<ProductionProps> = ({ userRole, inventoryItems, recipes, setRecipes, onProductionConfirm }) => {
  const [activeTab, setActiveTab] = useState<'produce' | 'builder'>('produce');
  const isManager = (userRole || '').toLowerCase() === 'manager';

  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(recipes[0]?.id || '');
  const [batchCount, setBatchCount] = useState<number>(1);
  const [customCosts, setCustomCosts] = useState<{ [key: string]: number }>({});

  const [newRecipeName, setNewRecipeName] = useState('');
  const [newOutputQty, setNewOutputQty] = useState('');
  const [newOutputUnit, setNewOutputUnit] = useState('ပိဿာ');
  const [newIngredients, setNew
