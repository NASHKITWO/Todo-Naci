package android.app; public class AlarmManager { public static java.util.List<String> cancelled=new java.util.ArrayList<>(); public void cancel(PendingIntent p){cancelled.add(p.tag);} }
