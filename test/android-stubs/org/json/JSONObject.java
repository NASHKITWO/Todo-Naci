package org.json;
import java.util.*; import java.util.regex.*;
public class JSONObject { final Map<String,String> m=new HashMap<>();
  public JSONObject(){}
  JSONObject(String s){ Matcher k=Pattern.compile("\"(\\w+)\":(\"([^\"]*)\"|-?\\d+)").matcher(s); while(k.find()) m.put(k.group(1), k.group(3)!=null?k.group(3):k.group(2)); }
  public String optString(String k,String d){return m.containsKey(k)?m.get(k):d;} public int optInt(String k,int d){return m.containsKey(k)?Integer.parseInt(m.get(k)):d;} }
