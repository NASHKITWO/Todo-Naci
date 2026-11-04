package org.json;
import java.util.*; import java.util.regex.*;
public class JSONArray { final List<Object> items=new ArrayList<>();
  public JSONArray(){}
  public JSONArray(String s) throws JSONException { s=s.trim(); if(!s.startsWith("[")||!s.endsWith("]")) throw new JSONException();
    Matcher m=Pattern.compile("\\{[^{}]*\\}").matcher(s); boolean any=false; while(m.find()){ any=true; items.add(new JSONObject(m.group())); }
    if(!any){ Matcher q=Pattern.compile("\"([^\"]*)\"").matcher(s); while(q.find()) items.add(q.group(1)); } }
  public JSONArray put(Object o){items.add(o);return this;} public int length(){return items.size();}
  public JSONObject getJSONObject(int i) throws JSONException {return (JSONObject)items.get(i);} public String getString(int i) throws JSONException {return String.valueOf(items.get(i));}
  public String toString(){ StringBuilder b=new StringBuilder("["); for(int i=0;i<items.size();i++){ if(i>0)b.append(","); b.append("\""+items.get(i)+"\""); } return b+"]"; } }
