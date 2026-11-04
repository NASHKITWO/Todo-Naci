package android.app; import java.util.*; public class NotificationManager { public static final List<Integer> cancelled=new ArrayList<>(); public void cancel(int id){cancelled.add(id);} }
