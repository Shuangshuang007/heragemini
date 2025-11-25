// 导入扩展的城市区域定义
import { greaterAreaMapExtended } from './greaterAreaMapExtended';

export interface GreaterAreaDefinition {
  core: string[];     // 方圆 10 公里以内（权重正常）
  fringe: string[];   // 10–20 公里，次优区域（权重可略降）
}

/**
 * 从城市名称中提取基础城市名（去除州/省缩写）
 * 例如: "New York, NY" -> "New York", "Sydney, NSW" -> "Sydney"
 */
function extractBaseCityName(city: string): string {
  if (!city) return city;
  // 匹配 ", XX" 格式（州/省缩写，通常是 2-3 个字母）
  const match = city.match(/^(.+?),\s*[A-Z]{2,3}$/);
  return match ? match[1].trim() : city.trim();
}

// 原有的 4 个城市定义
const greaterAreaMapOriginal: Record<string, GreaterAreaDefinition> = {
  Melbourne: {
    core: [
      "Melbourne", "Southbank", "Docklands", "Carlton", "Parkville", "Fitzroy", "East Melbourne",
      "West Melbourne", "North Melbourne", "South Yarra", "Richmond", "Collingwood",
      "Abbotsford", "Prahran", "St Kilda", "Albert Park", "Port Melbourne", "Toorak", 
      "Hawthorn", "Brunswick", "Brunswick East", "Carlton North", "Camberwell", "Malvern",
      "Cremorne", "Armadale", "Windsor", "St Kilda East", "Prahran East", "South Yarra East",
      "Richmond East", "Burnley"
    ],
    fringe: [
      "Footscray", "Yarraville", "Maribyrnong", "Ascot Vale", "Moonee Ponds", "Essendon",
      "Coburg", "Northcote", "Thornbury", "Caulfield", "Elwood", "Ashburton", "Balwyn", 
      "Box Hill", "Burwood", "Preston", "Ivanhoe", "Heidelberg", "Flemington", "Kensington",
      "Williams Landing", "Tullamarine", "Sunshine", "Braybrook", "Altona", "Glen Iris"
    ]
  },

  Sydney: {
    core: [
      "Sydney", "The Rocks", "Haymarket", "Ultimo", "Glebe", "Pyrmont", "Darlinghurst",
      "Surry Hills", "Redfern", "Chippendale", "Newtown", "Camperdown", "Eveleigh",
      "Paddington", "Woolloomooloo", "Millers Point", "Potts Point", "Barangaroo",
      "Zetland", "Alexandria", "Mascot", "Waterloo"
    ],
    fringe: [
      "North Sydney", "Crows Nest", "Chatswood", "Lane Cove", "Strathfield", "Ashfield",
      "Burwood", "Rhodes", "Concord", "Leichhardt", "Balmain", "Marrickville",
      "Dulwich Hill", "Five Dock", "Drummoyne", "St Peters", "Sydenham", "Hurstville"
    ]
  },

  Perth: {
    core: [
      "Perth", "Northbridge", "East Perth", "West Perth", "Highgate", "Mount Lawley",
      "Leederville", "Subiaco", "West Leederville", "Shenton Park", "Jolimont", 
      "Daglish", "Wembley", "Glendalough", "Scarborough", "Trigg", "City Beach",
      "Floreat", "Dalkeith", "Nedlands", "Crawley", "Claremont", "Cottesloe"
    ],
    fringe: [
      "Fremantle", "South Fremantle", "North Fremantle", "White Gum Valley",
      "Bibra Lake", "Cockburn Central", "Success", "Atwell", "Aubin Grove",
      "Canning Vale", "Willetton", "Bull Creek", "Murdoch", "Winthrop",
      "Bentley", "Victoria Park", "Lathlain", "Carlisle", "Burswood", "Rivervale"
    ]
  },

  Brisbane: {
    core: [
      "Brisbane", "Fortitude Valley", "New Farm", "Teneriffe", "Newstead", "Bowen Hills",
      "Herston", "Kelvin Grove", "Red Hill", "Paddington", "Bardon", "Ashgrove",
      "Auchenflower", "Toowong", "St Lucia", "West End", "South Brisbane",
      "Kangaroo Point", "Woolloongabba", "East Brisbane", "Coorparoo", "Greenslopes"
    ],
    fringe: [
      "Chermside", "Aspley", "Bracken Ridge", "Bald Hills", "Strathpine", "Lawnton",
      "Petrie", "Kallangur", "North Lakes", "Mango Hill", "Redcliffe", "Scarborough",
      "Sandgate", "Shorncliffe", "Wynnum", "Manly", "Cleveland", "Capalaba",
      "Carindale", "Mount Gravatt", "Eight Mile Plains", "Sunnybank", "Runcorn"
    ]
  }
};

// 合并原有定义和扩展定义（扩展定义优先，覆盖同名城市）
export const greaterAreaMap: Record<string, GreaterAreaDefinition> = {
  ...greaterAreaMapOriginal,
  ...greaterAreaMapExtended
};

/**
 * 获取城市的基础名称（用于匹配 greaterAreaMap）
 * @param city 城市名称（可能包含州/省缩写）
 * @returns 基础城市名称
 */
export function getBaseCityName(city: string): string {
  return extractBaseCityName(city);
}

/**
 * 检查位置是否属于fringe区域
 * @param location 职位位置
 * @param city 用户选择的城市
 * @returns 是否为fringe区域
 */
export function isFringeLocation(location: string, city: string): boolean {
  const baseCityName = extractBaseCityName(city);
  const greaterArea = greaterAreaMap[baseCityName] || greaterAreaMap[city];
  if (!greaterArea) return false;
  
  const normalizedLocation = location.toLowerCase();
  return greaterArea.fringe.some(fringeLoc => 
    normalizedLocation.includes(fringeLoc.toLowerCase())
  );
}

/**
 * 获取位置权重
 * @param location 职位位置
 * @param city 用户选择的城市
 * @returns 权重系数（fringe区域为0.85，其他为1.0）
 */
export function getLocationWeight(location: string, city: string): number {
  return isFringeLocation(location, city) ? 0.85 : 1.0;
} 