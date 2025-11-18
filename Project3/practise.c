#define _CRT_SECURE_NO_WARNINGS
#define pi 3.14159
#define BEEP '\a'
#define size  10
#define STOP '|'
#include <stdio.h>
#include <string.h>// 包含getchar 与putchar函数
#include <math.h>
#include <ctype.h> //包含可以检测字符类型的函数
#include <stdbool.h> //为 bool false true提供定义

void z(int* a, int* p);
int main()
{
	int a, b;
	scanf("%d %d", &a, &b);

	z(&a, &b);

	return 0;
}



void z(int* a ,int* p)
{
	int m = *a % *p;
	int n = *a / *p;

	
	if ( n != 0)
		z(&n, p);
	



	printf("%d", m);
}

/*

&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
&   10进制转2进制                                             #
&                                                             # 
&                                                             #
&                                                             #
&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&

void er(int n);
int main()
{
	int n;
	
	
	while (scanf("%d", &n) == 1)
	{
		er(n);
		printf("\n");
	}

	return 0;
}

void er(int n)
{
	int r;
	r = n % 2;
	if (n >= 2)
		er(n / 2);
	if (r == 1)
		printf("1");
	else                                                                               
		printf("0");

	return;
}


*/









/*void a(char c, int l, int w);
int main()
{
	int ch;
	int r, cc;

	printf("1 num 2 char\n");
	while ((ch = getchar()) != '\n')
	{
		if (scanf("%d %d", &r, &cc) != 2)
			break;
		a(ch, r, cc);
		while (getchar() != '\n')//缓冲区排干净
			continue;
		printf("ji xu shu ru\n");
		printf("a newline to quit\n");

	}
	printf("done!\n");
	
	return 0;
}

void a(char cr, int l, int w)
{
	int row, col;
	for (row = 1; row <= l; row++)
	{
		for (col = 1; col <= w; col++)
		{
			putchar(cr);
		}
		putchar('\n');
	}
}

*/



/*
int main()
{
	char c;
	char prev;
	long n_chars = 0L;
	int n_lines = 0;
	int n_words = 0;
	int p_lines = 0;
	bool inword = false;

	printf("shuru zifucuan\n");
	prev = '\n';
	while ((c = getchar()) != STOP)
	{
		n_chars++;
		if (c == '\n')
			n_lines++;
		if (!isspace(c) && !inword)
		{
			inword = true;
			n_words++;
		}
		if (isspace(c) && inword)
			inword = false;
		prev = c;
	}
	if (prev != '\n')
		p_lines = 1;
	printf("字符 = %ld,words = %d,lines = %d ", n_chars, n_words, n_lines);
	printf(" %d", p_lines);
	return 0;
}
*/
/*
printf("%d its factors are ", number);
			printf("%d ", yzi);
*/



/*
double power(double n, int p);
int main()
{
	double x, xpow;
	int exp;
	printf("1\n");

	while (scanf("%lf%d", &x, &exp) == 2)
	{
		xpow = power(x, exp);
		printf("%10lf\n",xpow);
		.;.
	}
	return 0;
}
double power(double n, int p)
{
	double pow = 1;
	int i;

	for (i = 1; i <= p; i++)
		pow *= n;
	return pow;
}
*/