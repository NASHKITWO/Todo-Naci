package android.content; import java.util.*; public class Intent { String action; String data; Map<String,String> extras=new HashMap<>();
 public Intent(){} public Intent(Intent o){action=o.action;data=o.data;extras.putAll(o.extras);} public Intent(Context c, Class<?> k){}
 public Intent setAction(String a){action=a;return this;} public String getAction(){return action;} public Intent setData(android.net.Uri u){data=u.toString();return this;}
 public Intent putExtra(String k,String v){extras.put(k,v);return this;} public String getStringExtra(String k){return extras.get(k);} public void removeExtra(String k){extras.remove(k);} }
