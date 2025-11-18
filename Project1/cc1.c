#define _CRT_SECURE_NO_WARNINGS
#include <stdio.h>

int main()
{
    float weight; //重量
    float value; // 价值

    printf("are you worth your weight in platinum\n");
    printf("let's check it out.\n");
    printf("please enter your weight in pounds:");

    //获取输入
    scanf("%f", &weight);
    //转化
    value = 1700 * weight * 14.5833;
    printf("your weight in platinum is worth $%.2f.\n", value); // %.2f意思为输出2位小数的结果
    printf("you are worth that!\n");
    printf("eat more to maintain your value.\n");
    getchar();
    getchar();
    return 0;



}