#define _CRT_SECURE_NO_WARNINGS
#include <stdio.h>
void zzl();
int main()
{
    
    printf("please ");
    zzl();
    printf("wow its so big!");
    return 0;
}
void zzl()
{
    int ages = 0;
    printf("enter your ages\n");
    scanf("%d", &ages);
    printf("your ages is %d,\n", ages);
}