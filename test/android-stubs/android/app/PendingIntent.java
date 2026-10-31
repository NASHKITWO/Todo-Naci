package android.app; public class PendingIntent { public static final int FLAG_UPDATE_CURRENT=1, FLAG_IMMUTABLE=2; public static java.util.List<String> made=new java.util.ArrayList<>();
 public static PendingIntent getActivity(android.content.Context c,int r,android.content.Intent i,int f){made.add("activity#"+r+":"+i.getStringExtra("widget_action"));return new PendingIntent();}
 public static PendingIntent getBroadcast(android.content.Context c,int r,android.content.Intent i,int f){made.add("broadcast#"+r+":"+i.getAction()+":"+i.getStringExtra("uid"));return new PendingIntent();} }
